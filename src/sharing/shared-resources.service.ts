import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/tenant-context/tenant-context.service';
import { PolicyService } from '../common/policy/policy.service';
import { CreateShareDto } from './dto/create-share.dto';

@Injectable()
export class SharedResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly policy: PolicyService,
  ) {}

  /** Share one of MY tenant's items with another tenant. */
  async share(dto: CreateShareDto) {
    const ctx = this.tenantContext.get()!;

    // `.scoped` naturally restricts this to items my own tenant owns —
    // if the id belongs to someone else's tenant, this returns null and
    // we correctly refuse to create a share for a resource we don't own.
    const owned = await this.prisma.scoped.contentItem.findFirst({ where: { id: dto.contentItemId } });
    if (!owned) throw new NotFoundException('Content item not found in your tenant');

    const existing = await this.prisma.sharedResource.findUnique({
      where: { contentItemId_tenantId: { contentItemId: dto.contentItemId, tenantId: dto.targetTenantId } },
    });

    if (existing) {
      return this.prisma.sharedResource.update({
        where: { id: existing.id },
        data: { permissionLevel: dto.permissionLevel, sharedBy: ctx.userId },
      });
    }
    return this.prisma.sharedResource.create({
      data: {
        contentItemId: dto.contentItemId,
        tenantId: dto.targetTenantId,
        permissionLevel: dto.permissionLevel,
        sharedBy: ctx.userId,
      },
    });
  }

  /** What has MY tenant shared out to others. */
  listOutgoing() {
    const ctx = this.tenantContext.get()!;
    return this.prisma.sharedResource.findMany({
      where: { contentItem: { tenantId: ctx.tenantId } },
      include: { contentItem: { select: { id: true, title: true, contentType: true } } },
    });
  }

  /** What has been shared WITH my tenant. */
  listIncoming() {
    const ctx = this.tenantContext.get()!;
    return this.prisma.sharedResource.findMany({ where: { tenantId: ctx.tenantId } });
  }

  async revoke(id: string) {
    const ctx = this.tenantContext.get()!;
    const share = await this.prisma.sharedResource.findFirst({
      where: { id, contentItem: { tenantId: ctx.tenantId } },
    });
    if (!share) throw new NotFoundException('Share not found');
    await this.prisma.sharedResource.delete({ where: { id } });
    return { revoked: true };
  }

  /**
   * C4's actual cross-tenant read: the ONE deliberate path that reaches
   * across the tenant boundary the mandatory-scoping extension otherwise
   * enforces everywhere else. Every step here is explicit and auditable —
   * there's no way to reach a cross-tenant row through any other service.
   */
  async getSharedItem(contentItemId: string) {
    const ctx = this.tenantContext.get()!;

    const share = await this.prisma.sharedResource.findUnique({
      where: { contentItemId_tenantId: { contentItemId, tenantId: ctx.tenantId } },
    });
    // Not sharing existence-vs-permission info back to the caller — a
    // missing share and a nonexistent item look identical from outside.
    if (!share) throw new NotFoundException('Content item not found');

    // Raw client, deliberately: this row belongs to another tenant by
    // definition, so `.scoped` (which would inject MY tenantId) can never
    // be the right tool here.
    const item = await this.prisma.contentItem.findUniqueOrThrow({ where: { id: contentItemId } });

    const allowed = this.policy.can(
      'view',
      { userId: ctx.userId, tenantId: ctx.tenantId, role: ctx.role as any },
      {
        tenantId: item.tenantId,
        confidentialityLevel: item.confidentialityLevel,
        sharedWith: { [ctx.tenantId]: share.permissionLevel },
      },
    );
    if (!allowed) {
      throw new ForbiddenException('You are not permitted to view this shared item.');
    }
    return item;
  }
}
