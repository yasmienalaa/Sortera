import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { Audit } from '../common/audit/audit.decorator';
import { Roles, RolesGuard } from '../common/policy/roles.guard';
import { AccessRequestsAdminService } from './access-requests-admin.service';

@Controller('access-requests')
@UseGuards(RolesGuard)
export class AccessRequestsAdminController {
  constructor(private readonly service: AccessRequestsAdminService) {}

  @Get('pending')
  @Audit('access_request', 'view')
  listPending() {
    return this.service.listPending();
  }

  @Patch(':id/approve')
  @Roles('OWNER', 'SUPER_ADMIN', 'ADMIN')
  @Audit('access_request', 'approve')
  approve(@Param('id') id: string, @Body('validityDays') validityDays?: number) {
    return this.service.approve(id, validityDays);
  }

  @Patch(':id/reject')
  @Roles('OWNER', 'SUPER_ADMIN', 'ADMIN')
  @Audit('access_request', 'reject')
  reject(@Param('id') id: string) {
    return this.service.reject(id);
  }
}
