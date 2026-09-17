import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/tenant-context/tenant-context.service';
import { StorageService } from '../storage/storage.service';
import { redisConnection, WATERMARK_QUEUE, WatermarkJobData } from './watermark.queue';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';

const WATERMARK_CACHE_TTL_MINUTES = 30;

@Injectable()
export class ResearcherPortalService {
  private readonly watermarkQueue = new Queue<WatermarkJobData>(WATERMARK_QUEUE, {
    connection: redisConnection(),
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly storage: StorageService,
  ) {}

  /** Free browsing — no access_request needed for PUBLIC + PUBLISHED items. */
  browse() {
    return this.prisma.scoped.contentItem.findMany({
      where: { confidentialityLevel: 'PUBLIC', lifecycleStatus: 'PUBLISHED', deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, contentType: true, createdAt: true },
    });
  }

  async requestAccess(dto: CreateAccessRequestDto) {
    const ctx = this.tenantContext.get()!;
    const item = await this.prisma.scoped.contentItem.findFirst({ where: { id: dto.resourceId } });
    if (!item) throw new NotFoundException('Content item not found');

    const existing = await this.prisma.scoped.accessRequest.findFirst({
      where: { researcherId: ctx.userId, resourceId: dto.resourceId },
    });
    if (existing) return existing; // idempotent — resend of the same request

    return this.prisma.scoped.accessRequest.create({
      data: { researcherId: ctx.userId, resourceId: dto.resourceId } as any,
    });
  }

  listMyRequests() {
    const ctx = this.tenantContext.get()!;
    return this.prisma.scoped.accessRequest.findMany({
      where: { researcherId: ctx.userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * "أي طلب وصول يمر عبر هذا الجدول قبل أن يُرجع الـ API أي بيانات فعلية" —
   * checked here on every single view, not cached from request-time.
   */
  async view(contentItemId: string) {
    const item = await this.assertViewable(contentItemId);
    return item;
  }

  async requestDownload(contentItemId: string) {
    const item = await this.assertViewable(contentItemId);
    const ctx = this.tenantContext.get()!;

    if (item.contentType !== 'VIDEO' && item.contentType !== 'IMAGE') {
      throw new ForbiddenException(
        'On-demand watermarked download is only wired for video/image in this build — documents are served as-is via a signed URL (follow-up: add a PDF watermark overlay path).',
      );
    }

    const watermarkJob = await this.prisma.scoped.watermarkJob.create({
      data: {
        contentItemId,
        researcherId: ctx.userId,
        expiresAt: new Date(Date.now() + WATERMARK_CACHE_TTL_MINUTES * 60 * 1000),
      } as any,
    });

    const researcher = await this.prisma.researcherAccount.findUniqueOrThrow({ where: { id: ctx.userId } });

    await this.watermarkQueue.add('watermark', {
      watermarkJobId: watermarkJob.id,
      tenantId: ctx.tenantId,
      contentItemId,
      researcherId: ctx.userId,
      researcherLabel: `${researcher.fullName} — ${new Date().toISOString().slice(0, 10)}`,
    });

    return { watermarkJobId: watermarkJob.id, status: watermarkJob.status };
  }

  async getWatermarkJob(id: string) {
    const job = await this.prisma.scoped.watermarkJob.findFirst({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');
    const ctx = this.tenantContext.get()!;
    if (job.researcherId !== ctx.userId) throw new ForbiddenException();

    if (job.status !== 'DONE' || !job.storagePath) {
      return { status: job.status, error: job.error };
    }
    const downloadUrl = await this.storage.signedDownloadUrl(job.storagePath, 300);
    return { status: job.status, downloadUrl };
  }

  private async assertViewable(contentItemId: string) {
    const item = await this.prisma.scoped.contentItem.findFirst({
      where: { id: contentItemId, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Content item not found');

    if (item.confidentialityLevel === 'PUBLIC' && item.lifecycleStatus === 'PUBLISHED') {
      return item;
    }

    const ctx = this.tenantContext.get()!;
    const approval = await this.prisma.scoped.accessRequest.findFirst({
      where: { researcherId: ctx.userId, resourceId: contentItemId, status: 'APPROVED' },
    });
    const stillValid = approval && (!approval.expiryDate || approval.expiryDate > new Date());
    if (!stillValid) {
      // Same response whether the item is CONFIDENTIAL, has no request, or
      // has an expired one — not distinguishing these to an external party.
      throw new ForbiddenException('You do not have approved access to this item.');
    }
    return item;
  }
}
