import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/tenant-context/tenant-context.service';
import { NotificationService } from '../notifications/notification.service';

const DEFAULT_APPROVAL_VALIDITY_DAYS = 30;

@Injectable()
export class AccessRequestsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly notifications: NotificationService,
  ) {}

  listPending() {
    return this.prisma.scoped.accessRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: { researcher: { select: { id: true, email: true, fullName: true } } },
    });
  }

  async approve(id: string, validityDays = DEFAULT_APPROVAL_VALIDITY_DAYS) {
    const ctx = this.tenantContext.get()!;
    const request = await this.prisma.scoped.accessRequest.findFirst({
      where: { id },
      include: { researcher: true, contentItem: { select: { title: true } } },
    });
    if (!request) throw new NotFoundException('Access request not found');

    const updated = await this.prisma.scoped.accessRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: ctx.userId,
        decidedAt: new Date(),
        expiryDate: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000),
      },
    });

    await this.notifications.sendAccessRequestApproved(request.researcher.email, request.contentItem.title);
    return updated;
  }

  async reject(id: string) {
    const ctx = this.tenantContext.get()!;
    const request = await this.prisma.scoped.accessRequest.findFirst({ where: { id } });
    if (!request) throw new NotFoundException('Access request not found');

    return this.prisma.scoped.accessRequest.update({
      where: { id },
      data: { status: 'REJECTED', approvedBy: ctx.userId, decidedAt: new Date() },
    });
  }
}
