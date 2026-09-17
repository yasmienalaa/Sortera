import { Module } from '@nestjs/common';
import { ResearcherPortalController } from './researcher-portal.controller';
import { ResearcherAuthService } from './researcher-auth.service';
import { ResearcherPortalService } from './researcher-portal.service';
import { WatermarkProcessor } from './watermark.processor';
import { WatermarkCleanupService } from './watermark-cleanup.service';
import { AccessRequestsAdminController } from './access-requests-admin.controller';
import { AccessRequestsAdminService } from './access-requests-admin.service';

@Module({
  controllers: [ResearcherPortalController, AccessRequestsAdminController],
  providers: [
    ResearcherAuthService,
    ResearcherPortalService,
    WatermarkProcessor,
    WatermarkCleanupService,
    AccessRequestsAdminService,
  ],
})
export class ResearcherPortalModule {}
