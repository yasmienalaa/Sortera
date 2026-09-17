import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Audit } from '../common/audit/audit.decorator';
import { Roles, RolesGuard } from '../common/policy/roles.guard';
import { SharedResourcesService } from './shared-resources.service';
import { CreateShareDto } from './dto/create-share.dto';

@Controller()
@UseGuards(RolesGuard)
export class SharedResourcesController {
  constructor(private readonly service: SharedResourcesService) {}

  @Post('shared-resources')
  @Roles('OWNER', 'SUPER_ADMIN', 'ADMIN')
  @Audit('shared_resource', 'create')
  share(@Body() dto: CreateShareDto) {
    return this.service.share(dto);
  }

  @Get('shared-resources/outgoing')
  @Audit('shared_resource', 'view')
  listOutgoing() {
    return this.service.listOutgoing();
  }

  @Get('shared-resources/incoming')
  @Audit('shared_resource', 'view')
  listIncoming() {
    return this.service.listIncoming();
  }

  @Delete('shared-resources/:id')
  @Roles('OWNER', 'SUPER_ADMIN', 'ADMIN')
  @Audit('shared_resource', 'revoke')
  revoke(@Param('id') id: string) {
    return this.service.revoke(id);
  }

  // The actual cross-tenant read — deliberately a distinct route from
  // GET /content-items/:id, never folded into it (see README).
  @Get('shared-with-me/:contentItemId')
  @Audit('shared_resource', 'view')
  getSharedItem(@Param('contentItemId') contentItemId: string) {
    return this.service.getSharedItem(contentItemId);
  }
}
