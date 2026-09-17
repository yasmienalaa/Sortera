import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/tenant-context/tenant-context.service';
import { SearchService } from './search.service';
import { CreateSavedSearchDto } from './dto/create-saved-search.dto';
import { SearchQueryDto } from './dto/search-query.dto';

@Injectable()
export class SavedSearchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly searchService: SearchService,
  ) {}

  create(dto: CreateSavedSearchDto) {
    const ctx = this.tenantContext.get()!;
    return this.prisma.scoped.savedSearch.create({
      data: { userId: ctx.userId, name: dto.name, queryParams: dto.queryParams },
    });
  }

  listMine() {
    const ctx = this.tenantContext.get()!;
    return this.prisma.scoped.savedSearch.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async run(id: string) {
    const ctx = this.tenantContext.get()!;
    const saved = await this.prisma.scoped.savedSearch.findFirst({ where: { id } });
    if (!saved) throw new NotFoundException('Saved search not found');
    if (saved.userId !== ctx.userId) throw new ForbiddenException();
    // "يُحوَّل لاستعلام على الفهرس وقت التشغيل" — re-runs live, never
    // returns a stale cached result set.
    return this.searchService.search(saved.queryParams as unknown as SearchQueryDto);
  }

  async delete(id: string) {
    const ctx = this.tenantContext.get()!;
    const saved = await this.prisma.scoped.savedSearch.findFirst({ where: { id } });
    if (!saved) throw new NotFoundException('Saved search not found');
    if (saved.userId !== ctx.userId) throw new ForbiddenException();
    await this.prisma.scoped.savedSearch.delete({ where: { id } });
    return { deleted: true };
  }
}
