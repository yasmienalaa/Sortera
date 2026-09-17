import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventTypeDto } from './dto/create-event-type.dto';

/**
 * A10: controlled vocabulary instead of free text, so "مؤتمر صحفي" and
 * "مؤتمر صحافي" don't fragment search/filters as two different values.
 */
@Injectable()
export class EventTypesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.scoped.eventType.findMany({ orderBy: { name: 'asc' } });
  }

  create(dto: CreateEventTypeDto) {
    return this.prisma.scoped.eventType.create({ data: dto as any });
  }
}
