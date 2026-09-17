import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class WatermarkCleanupService {
  private readonly logger = new Logger(WatermarkCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run() {
    // Raw client: this spans every tenant's expired jobs in one pass —
    // same category as the dashboard/retention crons. No `.scoped` is
    // even relevant here since we're deleting by expiresAt globally, not
    // reading "my tenant's" data.
    const expired = await this.prisma.watermarkJob.findMany({
      where: { expiresAt: { lte: new Date() } },
    });

    for (const job of expired) {
      try {
        if (job.storagePath) {
          await this.storage.deleteRaw(job.storagePath);
        }
        await this.prisma.watermarkJob.delete({ where: { id: job.id } });
      } catch (err) {
        this.logger.error(`Failed to clean up watermark job ${job.id}`, err as Error);
      }
    }
  }
}
