import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/tenant-context/tenant-context.service';
import { StorageService } from '../storage/storage.service';
import { DOCUMENT_PROCESSING_QUEUE, DocumentProcessingJob, redisConnection } from './document-processing.queue';

const execFileAsync = promisify(execFile);

// Below this many characters of extracted "real" text, we assume the PDF
// is a scanned image (no embedded text layer) and fall back to OCR,
// rather than trusting pdf-parse's near-empty result as the final answer.
const OCR_FALLBACK_THRESHOLD = 20;

@Injectable()
export class DocumentProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DocumentProcessor.name);
  private worker?: Worker<DocumentProcessingJob>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly storage: StorageService,
  ) {}

  onModuleInit() {
    // NOTE for production: running the worker in the same process as the
    // API is fine for this scaffold's scale, but the standard next step
    // is splitting this into its own Railway service (same codebase,
    // different start command) so a slow OCR job never competes with API
    // request handling. Flagging as a follow-up, not doing it now.
    this.worker = new Worker<DocumentProcessingJob>(
      DOCUMENT_PROCESSING_QUEUE,
      (job) => this.process(job.data),
      { connection: redisConnection(), concurrency: 2 },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`Document processing job ${job?.id} failed`, err);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async process(job: DocumentProcessingJob) {
    return this.tenantContext.run(
      { tenantId: job.tenantId, userId: 'system-worker', role: 'SUPER_ADMIN' },
      async () => {
        await this.prisma.scoped.documentFile.update({
          where: { contentItemId: job.contentItemId },
          data: { ocrStatus: 'PROCESSING' },
        });

        try {
          const buffer = await this.storage.download(job.storagePath);
          const isPdf = job.fileName.toLowerCase().endsWith('.pdf');
          const { text, pageCount } = isPdf
            ? await this.extractFromPdf(buffer)
            : await this.extractFromDocx(buffer);

          const item = await this.prisma.scoped.contentItem.findFirstOrThrow({
            where: { id: job.contentItemId },
          });
          await this.prisma.scoped.contentItem.update({
            where: { id: job.contentItemId },
            // Merged into metadata rather than a new column, per C1 — and
            // the fulltext_search.sql trigger already indexes metadata::text,
            // so this becomes searchable with no extra reindex call.
            data: { metadata: { ...(item.metadata as object), extractedText: text } },
          });

          await this.prisma.scoped.documentFile.update({
            where: { contentItemId: job.contentItemId },
            data: { ocrStatus: 'DONE', pageCount, ocrError: null },
          });
        } catch (err) {
          this.logger.error(`Failed processing content item ${job.contentItemId}`, err as Error);
          await this.prisma.scoped.documentFile.update({
            where: { contentItemId: job.contentItemId },
            data: { ocrStatus: 'FAILED', ocrError: (err as Error).message?.slice(0, 500) },
          });
        }
      },
    );
  }

  private async extractFromPdf(buffer: Buffer): Promise<{ text: string; pageCount: number | null }> {
    const parsed = await pdfParse(buffer);
    if (parsed.text.trim().length >= OCR_FALLBACK_THRESHOLD) {
      return { text: parsed.text, pageCount: parsed.numpages };
    }

    // C2: "لو صفحات ممسوحة ضوئيًا (صور) → تمريرها على محرك OCR (Tesseract)."
    this.logger.log('PDF has no usable text layer — falling back to OCR via pdftoppm + tesseract.js');
    return this.ocrScannedPdf(buffer);
  }

  /**
   * Renders each PDF page to a PNG using `pdftoppm` (part of the
   * `poppler-utils` system package — apt/apk install, one line, no
   * compiling) and OCRs each page with tesseract.js. Requires
   * `pdftoppm` to be on PATH; if it's missing, this throws a clear error
   * that becomes the DocumentFile.ocrError message rather than the
   * upload silently sitting at PENDING forever.
   */
  private async ocrScannedPdf(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hbj-ocr-'));
    const inputPath = path.join(tmpDir, 'input.pdf');
    const outputPrefix = path.join(tmpDir, 'page');

    try {
      await fs.writeFile(inputPath, buffer);

      try {
        await execFileAsync('pdftoppm', ['-png', '-r', '200', inputPath, outputPrefix]);
      } catch (err) {
        throw new Error(
          "OCR fallback requires the 'poppler-utils' system package (provides pdftoppm) — " +
            `install it (e.g. \`apt-get install poppler-utils\`) and retry. Original error: ${(err as Error).message}`,
        );
      }

      const pageFiles = (await fs.readdir(tmpDir))
        .filter((f) => f.startsWith('page') && f.endsWith('.png'))
        .sort(); // pdftoppm zero-pads page numbers, so lexical sort == page order

      if (pageFiles.length === 0) {
        throw new Error('pdftoppm produced no page images — the PDF may be corrupt or password-protected.');
      }

      const ocrWorker = await createWorker('ara+eng');
      try {
        const pageTexts: string[] = [];
        for (const fileName of pageFiles) {
          const imageBuffer = await fs.readFile(path.join(tmpDir, fileName));
          const { data } = await ocrWorker.recognize(imageBuffer);
          pageTexts.push(data.text);
        }
        return { text: pageTexts.join('\n\n'), pageCount: pageFiles.length };
      } finally {
        await ocrWorker.terminate();
      }
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }

  private async extractFromDocx(buffer: Buffer): Promise<{ text: string; pageCount: number | null }> {
    const result = await mammoth.extractRawText({ buffer });
    // .docx has no fixed "page" concept the way PDF does — page_count is
    // nullable in the schema specifically for this case.
    return { text: result.value, pageCount: null };
  }
}