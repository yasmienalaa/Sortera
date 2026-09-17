import { ConnectionOptions } from 'bullmq';

export const DOCUMENT_PROCESSING_QUEUE = 'document-processing';

export function redisConnection(): ConnectionOptions {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
  };
}

export interface DocumentProcessingJob {
  contentItemId: string;
  tenantId: string;
  storagePath: string;
  fileName: string;
}
