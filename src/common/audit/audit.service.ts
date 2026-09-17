import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';

export interface AuditEntry {
  actionType: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Writes one append-only row. Uses `prisma.scoped.create` so it still
   * goes through the mandatory-tenant-scoping extension (tenantId gets
   * injected automatically) AND the append-only guard (update/delete on
   * this model throws) — this is not a bypass path, it's the same safety
   * net everything else uses.
   *
   * Failure to write an audit log must never break the actual request —
   * we log the failure locally and move on, since an inaccessible archive
   * because the audit sink hiccuped would be worse than a rare missed log
   * line. (This is a Phase 1 tradeoff worth revisiting once B1's event
   * queue exists — the entry could be queued for retry instead.)
   */
  async record(entry: AuditEntry): Promise<void> {
    const ctx = this.tenantContext.get();
    if (!ctx) {
      this.logger.warn(
        `Audit entry dropped — no request context: ${entry.actionType}`,
      );
      return;
    }

    try {
      await this.prisma.scoped.auditLog.create({
        data: {
          userId: ctx.userId,
          actorType: ctx.actorType,
          actionType: entry.actionType,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          ipAddress: ctx.ipAddress,
          metadata: entry.metadata ?? {},
        } as any,
      });
    } catch (err) {
      this.logger.error(
        `Failed to write audit log for ${entry.actionType}`,
        err as Error,
      );
    }
  }
}
