import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Audit } from '../common/audit/audit.decorator';
import { Roles, RolesGuard } from '../common/policy/roles.guard';
import { CreateEventTypeDto } from './dto/create-event-type.dto';
import { EventTypesService } from './event-types.service';

@Controller('event-types')
@UseGuards(RolesGuard)
export class EventTypesController {
  constructor(private readonly service: EventTypesService) {}

  @Get()
  @Audit('event_type', 'view')
  list() {
    return this.service.list();
  }

  @Post()
  @Roles('OWNER', 'SUPER_ADMIN', 'ADMIN')
  @Audit('event_type', 'create')
  create(@Body() dto: CreateEventTypeDto) {
    return this.service.create(dto);
  }
}
