import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/tenant-context/tenant-context.service';

/**
 * A7: duplicate-detection review queue. The actual similarity computation
 * (face/name embedding comparison) happens in the AI worker that WRITES
 * here — this service is purely the human-review half: list what's
 * pending, and record the reviewer's decision. Performing the actual
 * merge (rewriting foreign keys from record B onto record A) depends on
 * a first-class "characters" table that isn't part of this schema yet,
 * so `merge` here only marks the suggestion resolved; wiring it to an
 * actual data merge is follow-up work once that table exists.
 */
@Injectable()
export class MergeSuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  listPending() {
    return this.prisma.scoped.pendingMergeSuggestion.findMany({
      where: { status: 'PENDING' },
      orderBy: { similarityScore: 'desc' },
    });
  }

  async resolve(id: string, decision: 'MERGED' | 'REJECTED') {
    const existing = await this.prisma.scoped.pendingMergeSuggestion.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Merge suggestion not found');

    const ctx = this.tenantContext.get()!;
    return this.prisma.scoped.pendingMergeSuggestion.update({
      where: { id },
      data: { status: decision, resolvedAt: new Date(), resolvedBy: ctx.userId },
    });
  }
}
