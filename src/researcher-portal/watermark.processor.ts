import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/tenant-context/tenant-context.service';
import { StorageService } from '../storage/storage.service';
import { redisConnection, WATERMARK_QUEUE, WatermarkJobData } from './watermark.queue';

const execFileAsync = promisify(execFile);

function escapeForDrawtext(text: string): string {
  // ffmpeg's drawtext filter uses ':' as an option separator and treats
  // several other characters specially — this covers the common cases for
  // a name + ISO date string, not a general-purpose escaper.
  return text.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

@Injectable()
export class WatermarkProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WatermarkProcessor.name);
  private worker?: Worker<WatermarkJobData>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly storage: StorageService,
  ) {}

  onModuleInit() {
    this.worker = new Worker<WatermarkJobData>(
      WATERMARK_QUEUE,
      (job) => this.process(job.data),
      { connection: redisConnection(), concurrency: 2 },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`Watermark job ${job?.id} failed`, err);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async process(data: WatermarkJobData) {
    return this.tenantContext.run(
      { tenantId: data.tenantId, userId: 'system-watermark-worker', role: 'SUPER_ADMIN', actorType: 'SYSTEM' },
      async () => {
        await this.prisma.scoped.watermarkJob.update({
          where: { id: data.watermarkJobId },
          data: { status: 'PROCESSING' },
        });

        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hbj-watermark-'));
        try {
          const mediaFile = await this.prisma.scoped.mediaFile.findFirst({
            where: { contentItemId: data.contentItemId },
          });
          if (!mediaFile) {
            throw new Error(
              'No source media file on record for this content item — it may predate media uploads going through this system.',
            );
          }

          const ext = path.extname(mediaFile.storagePath) || '.mp4';
          const inputPath = path.join(tmpDir, `input${ext}`);
          const outputPath = path.join(tmpDir, `output${ext}`);

          const buffer = await this.storage.download(mediaFile.storagePath);
          await fs.writeFile(inputPath, buffer);

          const label = escapeForDrawtext(data.researcherLabel);
          const drawtext = `drawtext=text='${label}':fontcolor=white:fontsize=18:box=1:boxcolor=black@0.5:x=10:y=h-30`;

          try {
            await execFileAsync('ffmpeg', [
              '-y',
              '-i', inputPath,
              '-vf', drawtext,
              '-codec:a', 'copy',
              outputPath,
            ]);
          } catch (err) {
            throw new Error(
              `ffmpeg failed (is it installed? \`apt-get install ffmpeg\`): ${(err as Error).message}`,
            );
          }

          const outputBuffer = await fs.readFile(outputPath);
          const cacheKey = this.storage.watermarkCacheKey(
            data.tenantId,
            data.contentItemId,
            data.researcherId,
            ext,
          );
          const storagePath = await this.storage.putRaw(cacheKey, outputBuffer, mediaFile.mimeType);

          await this.prisma.scoped.watermarkJob.update({
            where: { id: data.watermarkJobId },
            data: { status: 'DONE', storagePath, error: null },
          });
        } catch (err) {
          this.logger.error(`Watermark job ${data.watermarkJobId} failed`, err as Error);
          await this.prisma.scoped.watermarkJob.update({
            where: { id: data.watermarkJobId },
            data: { status: 'FAILED', error: (err as Error).message?.slice(0, 500) },
          });
        } finally {
          await fs.rm(tmpDir, { recursive: true, force: true });
        }
      },
    );
  }
}
