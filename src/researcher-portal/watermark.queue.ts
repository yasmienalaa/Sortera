import { redisConnection } from '../documents/document-processing.queue';

export const WATERMARK_QUEUE = 'watermark-processing';
export { redisConnection };

export interface WatermarkJobData {
  watermarkJobId: string;
  tenantId: string;
  contentItemId: string;
  researcherId: string;
  researcherLabel: string; // burned into the watermark text
}
