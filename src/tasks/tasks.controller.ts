import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { Audit } from '../common/audit/audit.decorator';
import { RolesGuard } from '../common/policy/roles.guard';
import { CreateTaskDto } from './dto/create-task.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(RolesGuard)
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Post()
  @Audit('task', 'create')
  create(@Body() dto: CreateTaskDto) {
    return this.service.create(dto);
  }

  @Get()
  @Audit('task', 'view')
  listForResearcher(@Query('researcherId') researcherId: string) {
    return this.service.listForResearcher(researcherId);
  }

  @Patch(':id/status')
  @Audit('task', 'update')
  updateStatus(@Param('id') id: string, @Body('status') status: TaskStatus) {
    return this.service.updateStatus(id, status);
  }
}
