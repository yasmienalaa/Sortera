import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  list(filters: { resourceType?: string; resourceId?: string; actorType?: string }) {
    return this.prisma.scoped.auditLog.findMany({
      where: {
        resourceType: filters.resourceType || undefined,
        resourceId: filters.resourceId || undefined,
        actorType: (filters.actorType as any) || undefined,
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }
}
