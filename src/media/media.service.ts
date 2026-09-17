import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/tenant-context/tenant-context.service';
import { StorageService } from '../storage/storage.service';
import { RetentionPoliciesService } from '../retention/retention-policies.service';
import { UploadMediaDto } from './dto/upload-media.dto';

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly storage: StorageService,
    private readonly retentionPolicies: RetentionPoliciesService,
  ) {}

  async upload(file: Express.Multer.File, dto: UploadMediaDto) {
    const ctx = this.tenantContext.get()!;
    const retention = await this.retentionPolicies.computeForNewItem(dto.contentType);

    const contentItem = await this.prisma.scoped.contentItem.create({
      data: {
        contentType: dto.contentType,
        title: dto.title,
        confidentialityLevel: dto.confidentialityLevel,
        eventId: dto.eventId,
        createdBy: ctx.userId,
        retentionExpiryDate: retention.retentionExpiryDate,
        appliedRetentionPolicy: retention.appliedRetentionPolicy,
      } as any,
    });

    const storagePath = await this.storage.upload(
      ctx.tenantId,
      contentItem.id,
      file.originalname,
      file.buffer,
      file.mimetype,
    );

    await this.prisma.scoped.mediaFile.create({
      data: { contentItemId: contentItem.id, storagePath, mimeType: file.mimetype } as any,
    });

    return contentItem;
  }
}
