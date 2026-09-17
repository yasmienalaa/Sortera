import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/tenant-context/tenant-context.service';
import { SearchService } from '../search/search.service';
import { CreateAiPredictionDto } from './dto/create-ai-prediction.dto';

/**
 * A7/A8/A9/B4: every AI tool result lands here as PENDING first. Nothing
 * downstream ("the main table") is wired in this scaffold to read
 * approved rows yet, because the domain tables that would consume them
 * (a proper Characters/Brands master table) aren't part of Phase 1/2's
 * schema — but the governance queue itself (pending -> approved/rejected,
 * with a human reviewer) is fully functional, which is the actual safety
 * requirement B4 asks for.
 */
@Injectable()
export class AiPredictionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly searchService: SearchService,
  ) {}

  create(dto: CreateAiPredictionDto) {
    return this.prisma.scoped.aiPrediction.create({ data: dto as any });
  }

  listPending() {
    return this.prisma.scoped.aiPrediction.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approve(id: string) {
    return this.resolve(id, 'APPROVED');
  }

  async reject(id: string) {
    // B4: "القرارات المرفوضة تُجمَّع لاستخدامها لاحقًا في تحسين النموذج" —
    // rejected rows are kept (status flips, nothing is deleted), so a
    // future retraining-export job can just query status='REJECTED'.
    return this.resolve(id, 'REJECTED');
  }

  private async resolve(id: string, status: 'APPROVED' | 'REJECTED') {
    const existing = await this.prisma.scoped.aiPrediction.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Prediction not found');

    const ctx = this.tenantContext.get()!;
    const updated = await this.prisma.scoped.aiPrediction.update({
      where: { id },
      data: { status, reviewedBy: ctx.userId, reviewedAt: new Date() },
    });

    if (status === 'APPROVED' && updated.predictionType === 'TEXT') {
      await this.searchService.reindex(updated.resourceId);
    }
    return updated;
  }
}
