import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/tenant-context/tenant-context.service';
import { CreateRelationDto } from './dto/create-relation.dto';

// A5: relations always shown WITH their reason (relation_type) and, for
// AI-sourced links, a confidence score — never a bare "related" list.
@Injectable()
export class ContentRelationsService {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  async listFor(contentItemId: string) {
    const [asSource, asTarget] = await Promise.all([
      this.prisma.scoped.contentRelation.findMany({
        where: { sourceId: contentItemId },
        include: { target: { select: { id: true, title: true, contentType: true } } },
      }),
      this.prisma.scoped.contentRelation.findMany({
        where: { targetId: contentItemId },
        include: { source: { select: { id: true, title: true, contentType: true } } },
      }),
    ]);
    return [
      ...asSource.map((r) => ({ id: r.id, relationType: r.relationType, confidenceScore: r.confidenceScore, item: r.target })),
      ...asTarget.map((r) => ({ id: r.id, relationType: r.relationType, confidenceScore: r.confidenceScore, item: r.source })),
    ];
  }

  create(dto: CreateRelationDto) {
    const ctx = this.tenantContext.get()!;
    return this.prisma.scoped.contentRelation.create({
      data: {
        ...dto,
        tenantId: ctx.tenantId,
        createdBy: ctx.userId,
      },
    });
  }
}
