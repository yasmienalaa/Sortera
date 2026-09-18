import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Audit } from '../common/audit/audit.decorator';
import { RolesGuard } from '../common/policy/roles.guard';
import { ContentRelationsService } from './content-relations.service';
import { CreateRelationDto } from './dto/create-relation.dto';

@Controller('content-relations')
@UseGuards(RolesGuard)
export class ContentRelationsController {
  constructor(private readonly service: ContentRelationsService) {}

  @Get()
  @Audit('content_relation', 'view')
  list(@Query('contentItemId') contentItemId: string) { return this.service.listFor(contentItemId); }

  @Post()
  @Audit('content_relation', 'create')
  create(@Body() dto: CreateRelationDto) { return this.service.create(dto); }
}
