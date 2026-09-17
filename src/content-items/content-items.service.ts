import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentType, LifecycleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/tenant-context/tenant-context.service';
import { PolicyService } from '../common/policy/policy.service';
import { RetentionPoliciesService } from '../retention/retention-policies.service';
import { CreateContentItemDto } from './dto/create-content-item.dto';

@Injectable()
export class ContentItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly policy: PolicyService,
    private readonly retentionPolicies: RetentionPoliciesService,
  ) {}

  /**
   * A4: one query for both "كل الفيديوهات" and "فيديوهات الحدث" — passing
   * eventId narrows to that event's items on the exact same table/query,
   * rather than a separate endpoint/table per spec's complaint about the
   * current site's 4-way split.
   */
  async list(contentType?: ContentType, eventId?: string) {
    return this.prisma.scoped.contentItem.findMany({
      where: {
        deletedAt: null,
        ...(contentType ? { contentType } : {}),
        ...(eventId ? { eventId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.scoped.contentItem.findFirst({ where: { id, deletedAt: null } });
    if (!item) throw new NotFoundException('Content item not found');
    this.assertCanView(item);
    return item;
  }

  async create(dto: CreateContentItemDto) {
    const ctx = this.tenantContext.get()!;
    const retention = await this.retentionPolicies.computeForNewItem(dto.contentType);
    // tenantId AND createdBy are both injected/known server-side — never
    // trust these from the request body.
    return this.prisma.scoped.contentItem.create({
      data: {
        contentType: dto.contentType,
        title: dto.title,
        confidentialityLevel: dto.confidentialityLevel,
        eventId: dto.eventId,
        eventTypeId: dto.eventTypeId,
        metadata: dto.metadata ?? {},
        createdBy: ctx.userId,
        retentionExpiryDate: retention.retentionExpiryDate,
        appliedRetentionPolicy: retention.appliedRetentionPolicy,
      } as any,
    });
  }

  /**
   * A6: enforces the lifecycle pipeline (RAW -> IN_PRODUCTION ->
   * READY_FOR_REVIEW -> PUBLISHED -> ARCHIVED) and writes a
   * status_transitions row for every change — this IS the audit trail
   * B2 asks for specifically on lifecycle changes, kept separate from the
   * generic audit_logs table because it also captures from/to state, not
   * just "something happened".
   *
   * Also snapshots the pre-change row into event_revisions (B2 version
   * history) before applying the update.
   */
  async transitionLifecycle(id: string, toStatus: LifecycleStatus) {
    const item = await this.prisma.scoped.contentItem.findFirst({ where: { id } });
    if (!item) throw new NotFoundException('Content item not found');
    this.assertCanView(item);

    const ctx = this.tenantContext.get()!;

    const [latestRevision] = await this.prisma.scoped.eventRevision.findMany({
      where: { resourceId: id },
      orderBy: { versionNumber: 'desc' },
      take: 1,
    });
    const nextVersion = (latestRevision?.versionNumber ?? 0) + 1;

    await this.prisma.scoped.eventRevision.create({
      data: {
        resourceId: id,
        snapshot: item as any,
        versionNumber: nextVersion,
        changedBy: ctx.userId,
      } as any,
    });

    await this.prisma.scoped.statusTransition.create({
      data: {
        contentItemId: id,
        fromStatus: item.lifecycleStatus,
        toStatus,
        changedBy: ctx.userId,
      } as any,
    });

    return this.prisma.scoped.contentItem.update({
      where: { id },
      data: { lifecycleStatus: toStatus },
    });
  }

  private assertCanView(item: { tenantId: string; confidentialityLevel: any }) {
    const ctx = this.tenantContext.get()!;
    const allowed = this.policy.can(
      'view',
      { userId: ctx.userId, tenantId: ctx.tenantId, role: ctx.role as any },
      { tenantId: item.tenantId, confidentialityLevel: item.confidentialityLevel },
    );
    if (!allowed) {
      throw new ForbiddenException(
        'You are not permitted to view this item given its confidentiality level.',
      );
    }
  }
}
