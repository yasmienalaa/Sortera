import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Audit } from '../common/audit/audit.decorator';
import { Roles, RolesGuard } from '../common/policy/roles.guard';
import { AiPredictionsService } from './ai-predictions.service';
import { CreateAiPredictionDto } from './dto/create-ai-prediction.dto';

@Controller('ai-predictions')
@UseGuards(RolesGuard)
export class AiPredictionsController {
  constructor(private readonly service: AiPredictionsService) {}

  // Called by the AI worker/service, not a human — kept unrestricted by
  // role here on purpose; lock this down to a service-to-service API key
  // once the actual AI workers exist (Phase 2 follow-up, not blocking).
  @Post()
  @Audit('ai_prediction', 'create')
  create(@Body() dto: CreateAiPredictionDto) {
    return this.service.create(dto);
  }

  @Get('pending')
  @Audit('ai_prediction', 'view')
  listPending() {
    return this.service.listPending();
  }

  @Patch(':id/approve')
  @Roles('OWNER', 'SUPER_ADMIN', 'ADMIN', 'MEDIA_ADMIN')
  @Audit('ai_prediction', 'approve')
  approve(@Param('id') id: string) {
    return this.service.approve(id);
  }

  @Patch(':id/reject')
  @Roles('OWNER', 'SUPER_ADMIN', 'ADMIN', 'MEDIA_ADMIN')
  @Audit('ai_prediction', 'reject')
  reject(@Param('id') id: string) {
    return this.service.reject(id);
  }
}
