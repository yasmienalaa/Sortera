import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ContentType, LifecycleStatus } from '@prisma/client';
import { Audit } from '../common/audit/audit.decorator';
import { RolesGuard } from '../common/policy/roles.guard';
import { ContentItemsService } from './content-items.service';
import { CreateContentItemDto } from './dto/create-content-item.dto';

@Controller('content-items')
@UseGuards(RolesGuard)
export class ContentItemsController {
  constructor(private readonly service: ContentItemsService) {}

  // A4: e.g. GET /content-items?contentType=VIDEO for "كل الفيديوهات",
  // GET /content-items?contentType=VIDEO&eventId=<id> for "فيديوهات الحدث".
  @Get()
  @Audit('content_item', 'view')
  list(@Query('contentType') contentType?: ContentType, @Query('eventId') eventId?: string) {
    return this.service.list(contentType, eventId);
  }

  @Get(':id')
  @Audit('content_item', 'view')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Audit('content_item', 'create')
  create(@Body() dto: CreateContentItemDto) {
    return this.service.create(dto);
  }

  // A6
  @Patch(':id/lifecycle')
  @Audit('content_item', 'update')
  transitionLifecycle(@Param('id') id: string, @Body('toStatus') toStatus: LifecycleStatus) {
    return this.service.transitionLifecycle(id, toStatus);
  }
}
