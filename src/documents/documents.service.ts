import { BadRequestException, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/tenant-context/tenant-context.service';
import { StorageService } from '../storage/storage.service';
import { RetentionPoliciesService } from '../retention/retention-policies.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DOCUMENT_PROCESSING_QUEUE, DocumentProcessingJob, redisConnection } from './document-processing.queue';

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc'];

@Injectable()
export class DocumentsService {
  private readonly queue = new Queue<DocumentProcessingJob>(DOCUMENT_PROCESSING_QUEUE, {
    connection: redisConnection(),
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly storage: StorageService,
    private readonly retentionPolicies: RetentionPoliciesService,
  ) {}

  async upload(file: Express.Multer.File, dto: UploadDocumentDto) {
    const ext = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(`Unsupported file type ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
    }

    const ctx = this.tenantContext.get()!;
    const retention = await this.retentionPolicies.computeForNewItem('DOCUMENT');

    // Created RAW/PENDING first, then the async job fills in the
    // extracted text — the request returns immediately rather than
    // blocking on OCR of a potentially large scanned document, per C2's
    // explicit "job يُوضع في queue للمعالجة (غير متزامن)".
    const contentItem = await this.prisma.scoped.contentItem.create({
      data: {
        contentType: 'DOCUMENT',
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

    await this.prisma.scoped.documentFile.create({
      data: {
        contentItemId: contentItem.id,
        storagePath,
        ocrStatus: 'PENDING',
      } as any,
    });

    await this.queue.add('process', {
      contentItemId: contentItem.id,
      tenantId: ctx.tenantId,
      storagePath,
      fileName: file.originalname,
    });

    return contentItem;
  }

  status(contentItemId: string) {
    return this.prisma.scoped.documentFile.findFirst({ where: { contentItemId } });
  }
}
