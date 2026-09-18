import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles, RolesGuard } from '../common/policy/roles.guard';
import { AuditLogsService } from './audit-logs.service';

// Staff-only, admin roles only — this is the "who did what" record.
@Controller('audit-logs')
@UseGuards(RolesGuard)
export class AuditLogsController {
  constructor(private readonly service: AuditLogsService) {}

  @Get()
  @Roles('OWNER', 'SUPER_ADMIN', 'ADMIN')
  list(
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
    @Query('actorType') actorType?: string,
  ) {
    return this.service.list({ resourceType, resourceId, actorType });
  }
}
