import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';

/**
 * A11: "الداشبورد يُغذَّى من نفس هذا الجدول — لا يوجد مصدرا بيانات
 * منفصلان لنفس الموضوع." DashboardService.compute() reads directly from
 * this table (see dashboard.service.ts) rather than maintaining separate
 * task-stat counters anywhere.
 */
@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateTaskDto) {
    return this.prisma.scoped.task.create({
      data: { ...dto, dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined },
    });
  }

  listForResearcher(researcherId: string) {
    return this.prisma.scoped.task.findMany({
      where: { researcherId },
      orderBy: { dueDate: 'asc' },
    });
  }

  updateStatus(id: string, status: TaskStatus) {
    return this.prisma.scoped.task.update({ where: { id }, data: { status } });
  }
}
