import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/tenant-context/tenant-context.service';
import { AuditService } from '../common/audit/audit.service';

const SOFT_DELETE_GRACE_DAYS = 7;

@Injectable()
export class RetentionEnforcementService {
  private readonly logger = new Logger(RetentionEnforcementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly auditService: AuditService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async run() {
    // Raw client, no `.scoped` — this cron spans every tenant by design,
    // same category as DashboardService's refresh job.
    const tenants = await this.prisma.tenant.findMany({ where: { isActive: true } });
    for (const tenant of tenants) {
      await this.tenantContext.run(
        { tenantId: tenant.id, userId: 'system-retention-cron', role: 'SUPER_ADMIN' },
        () => this.enforceForTenant(),
      );
    }
  }

  private async enforceForTenant() {
    await this.applyExpiryActions();
    await this.hardDeleteExpiredSoftDeletes();
  }

  private async applyExpiryActions() {
    const expiring = await this.prisma.scoped.contentItem.findMany({
      where: { retentionExpiryDate: { lte: new Date() }, deletedAt: null },
    });

    for (const item of expiring) {
      const action = (item.appliedRetentionPolicy as any)?.actionOnExpiry;
      try {
        if (action === 'ARCHIVE') {
          await this.prisma.scoped.contentItem.update({
            where: { id: item.id },
            data: { lifecycleStatus: 'ARCHIVED' },
          });
          // Actually moving the underlying file to a cold-storage tier
          // (e.g. S3 Glacier) is a StorageService follow-up — this marks
          // the record's lifecycle state, which is the part the rest of
          // the app (dashboard, filters) actually reads.
        } else if (action === 'DELETE') {
          // Soft-delete first — per spec's explicit "فترة أمان قبل الحذف
          // النهائي" — the hard-delete pass below only touches rows past
          // the grace period.
          await this.prisma.scoped.contentItem.update({
            where: { id: item.id },
            data: { deletedAt: new Date(), status: 'DELETED' },
          });
        }
        // NOTIFY_ONLY: intentionally no state change — a real notification
        // channel (email/Slack) is a follow-up; for now this at least
        // shows up in audit_logs below so it's not silently lost.

        await this.auditService.record({
          actionType: `content_item.retention_${(action ?? 'notify_only').toLowerCase()}`,
          resourceType: 'content_item',
          resourceId: item.id,
          metadata: { retentionExpiryDate: item.retentionExpiryDate },
        });
      } catch (err) {
        this.logger.error(`Retention action failed for content item ${item.id}`, err as Error);
      }
    }
  }

  private async hardDeleteExpiredSoftDeletes() {
    const graceCutoff = new Date(Date.now() - SOFT_DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000);
    const dueForHardDelete = await this.prisma.scoped.contentItem.findMany({
      where: { deletedAt: { lte: graceCutoff } },
    });

    for (const item of dueForHardDelete) {
      try {
        await this.auditService.record({
          actionType: 'content_item.hard_delete',
          resourceType: 'content_item',
          resourceId: item.id,
          metadata: { softDeletedAt: item.deletedAt },
        });

        // NOT a relational DELETE: status_transitions/event_revisions/
        // audit_logs hold a foreign key (or reference) to this row and
        // must never be deleted themselves (B2 — append-only history), so
        // an actual row delete would either throw on the FK constraint or
        // require cascading into records that must survive. Instead this
        // scrubs the content itself — title/metadata overwritten, the S3
        // object should be deleted via StorageService here too (follow-up:
        // wire that call in) — leaving a tombstone row that keeps every
        // historical reference valid. This is the standard pattern for
        // "right to erasure" compliance requirements, not a shortcut.
        await this.prisma.scoped.contentItem.update({
          where: { id: item.id },
          data: { title: '[deleted]', metadata: {} },
        });
      } catch (err) {
        this.logger.error(`Hard delete (scrub) failed for content item ${item.id}`, err as Error);
      }
    }
  }
}
