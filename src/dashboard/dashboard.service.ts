import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/tenant-context/tenant-context.service';

/**
 * A2: dashboard KPIs are read from a pre-computed snapshot, not a live
 * query over content_items on every page open — the spec calls this out
 * explicitly ("لضمان سرعة الفتح مع نمو الأرشيف"). The cron job below
 * refreshes it hourly; `latestOrCompute` also computes on-demand if
 * nothing exists yet, purely so a fresh dev/demo environment isn't stuck
 * showing nothing for up to an hour.
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async latestOrCompute() {
    const latest = await this.prisma.scoped.dashboardSnapshot.findFirst({
      orderBy: { computedAt: 'desc' },
    });
    if (latest) return this.serialize(latest);
    const ctx = this.tenantContext.get()!;
    return this.serialize(await this.computeForTenant(ctx.tenantId));
  }

  /** BigInt doesn't survive JSON.stringify — Express would 500 on this. */
  private serialize(snapshot: { storageUsedBytes: bigint } & Record<string, unknown>) {
    return { ...snapshot, storageUsedBytes: snapshot.storageUsedBytes.toString() };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async refreshAllTenants() {
    // Raw client: this cron job runs outside any single request's tenant
    // context by definition — it needs to see every tenant precisely so
    // it can compute each one's isolated snapshot in turn.
    const tenants = await this.prisma.tenant.findMany({ where: { isActive: true } });
    for (const tenant of tenants) {
      try {
        await this.tenantContext.run(
          { tenantId: tenant.id, userId: 'system-cron', role: 'SUPER_ADMIN', actorType: 'SYSTEM' },
          () => this.computeForTenant(tenant.id),
        );
      } catch (err) {
        this.logger.error(`Dashboard snapshot failed for tenant ${tenant.id}`, err as Error);
      }
    }
  }

  private async computeForTenant(tenantId: string) {
    const [byType, pendingAiReview, recentAdditions, restrictedAlerts, pendingTasks] = await Promise.all([
      this.prisma.scoped.contentItem.groupBy({ by: ['contentType'], _count: true }),
      this.prisma.scoped.aiPrediction.count({ where: { status: 'PENDING' } }),
      this.prisma.scoped.contentItem.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, contentType: true, createdAt: true },
      }),
      this.prisma.scoped.contentItem.count({
        where: { confidentialityLevel: 'RESTRICTED', lifecycleStatus: { in: ['RAW', 'READY_FOR_REVIEW'] } },
      }),
      // A11: "الداشبورد يُغذَّى من نفس هذا الجدول [tasks]" — was missing.
      this.prisma.scoped.task.count({ where: { status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
    ]);

    return this.prisma.scoped.dashboardSnapshot.create({
      data: {
        totalByContentType: Object.fromEntries(byType.map((b) => [b.contentType, b._count])),
        pendingAiReview,
        storageUsedBytes: 0n,
        recentAdditions,
        restrictedAlerts,
        pendingTasks,
      },
    });
  }
}
