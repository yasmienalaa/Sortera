import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { Audit } from '../common/audit/audit.decorator';
import { Roles, RolesGuard } from '../common/policy/roles.guard';
import { MergeSuggestionsService } from './merge-suggestions.service';

@Controller('merge-suggestions')
@UseGuards(RolesGuard)
export class MergeSuggestionsController {
  constructor(private readonly service: MergeSuggestionsService) {}

  @Get('pending')
  @Audit('merge_suggestion', 'view')
  listPending() {
    return this.service.listPending();
  }

  @Patch(':id/merge')
  @Roles('OWNER', 'SUPER_ADMIN', 'ADMIN', 'MEDIA_ADMIN')
  @Audit('merge_suggestion', 'merge')
  merge(@Param('id') id: string) {
    return this.service.resolve(id, 'MERGED');
  }

  @Patch(':id/reject')
  @Roles('OWNER', 'SUPER_ADMIN', 'ADMIN', 'MEDIA_ADMIN')
  @Audit('merge_suggestion', 'reject')
  reject(@Param('id') id: string) {
    return this.service.resolve(id, 'REJECTED');
  }
}
