import { Injectable } from '@nestjs/common';
import { ContentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRetentionPolicyDto } from './dto/create-retention-policy.dto';

@Injectable()
export class RetentionPoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.scoped.retentionPolicy.findMany({ where: { isActive: true } });
  }

  async upsert(dto: CreateRetentionPolicyDto) {
    const existing = await this.prisma.scoped.retentionPolicy.findFirst({
      where: { contentType: dto.contentType },
    });
    if (existing) {
      return this.prisma.scoped.retentionPolicy.update({ where: { id: existing.id }, data: dto });
    }
    return this.prisma.scoped.retentionPolicy.create({ data: dto as any });
  }

  /**
   * C3: computed ONCE at content_item creation time, and the policy's
   * values are snapshotted onto the item itself — a later change to the
   * tenant's policy must NOT retroactively change already-set expiry
   * dates, which is the exact failure mode the spec warns about.
   */
  async computeForNewItem(contentType: ContentType) {
    const policy = await this.prisma.scoped.retentionPolicy.findFirst({
      where: { contentType, isActive: true },
    });
    if (!policy) return { retentionExpiryDate: null as Date | null, appliedRetentionPolicy: null as any };

    const retentionExpiryDate = new Date(
      Date.now() + policy.retentionPeriodDays * 24 * 60 * 60 * 1000,
    );
    return {
      retentionExpiryDate,
      appliedRetentionPolicy: {
        policyId: policy.id,
        retentionPeriodDays: policy.retentionPeriodDays,
        actionOnExpiry: policy.actionOnExpiry,
        snapshotAt: new Date().toISOString(),
      },
    };
  }
}
