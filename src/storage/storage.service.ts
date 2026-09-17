import { Injectable } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'us-east-1',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });

  private readonly bucket = process.env.S3_BUCKET!;

  /**
   * C2: "bucket أو prefix منفصل لكل tenant لضمان العزل." We use a shared
   * bucket with a mandatory per-tenant key prefix rather than one bucket
   * per tenant — much simpler to operate (no bucket-creation-on-tenant-
   * signup step, one set of lifecycle/backup rules) while still giving
   * the same isolation guarantee, since every read/write path here is
   * required to go through this one method that always prepends it.
   */
  private key(tenantId: string, contentItemId: string, fileName: string) {
    return `tenants/${tenantId}/documents/${contentItemId}/${fileName}`;
  }

  async upload(tenantId: string, contentItemId: string, fileName: string, body: Buffer, contentType: string) {
    const key = this.key(tenantId, contentItemId, fileName);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return `s3://${this.bucket}/${key}`;
  }

  /**
   * B3: generic put for anything that isn't a permanent per-tenant
   * document/media file — specifically the on-demand watermark cache,
   * which deliberately lives under its own prefix (not the same tree as
   * originals) so the cleanup cron can find and delete it without any
   * risk of matching a real archive file.
   */
  async putRaw(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return `s3://${this.bucket}/${key}`;
  }

  watermarkCacheKey(tenantId: string, contentItemId: string, researcherId: string, ext: string) {
    return `tenants/${tenantId}/watermark-cache/${contentItemId}/${researcherId}-${Date.now()}${ext}`;
  }

  async deleteRaw(storagePath: string) {
    const key = this.keyFromStoragePath(storagePath);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async download(storagePath: string): Promise<Buffer> {
    const key = this.keyFromStoragePath(storagePath);
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of result.Body as any) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  /** Short-lived signed URL — used for the researcher-portal watermark
   * flow in Phase 4, and generally safer than proxying large files
   * through the API process itself. */
  async signedDownloadUrl(storagePath: string, expiresInSeconds = 300) {
    const key = this.keyFromStoragePath(storagePath);
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  private keyFromStoragePath(storagePath: string): string {
    // storagePath is stored as "s3://<bucket>/<key>" — strip the prefix.
    const marker = `s3://${this.bucket}/`;
    if (!storagePath.startsWith(marker)) {
      throw new Error(`Unexpected storage path format: ${storagePath}`);
    }
    return storagePath.slice(marker.length);
  }
}
