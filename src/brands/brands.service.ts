import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/tenant-context/tenant-context.service';
import { CreateBrandDto } from './dto/create-brand.dto';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  list(search?: string) {
    return this.prisma.scoped.brand.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  create(dto: CreateBrandDto) {
    const ctx = this.tenantContext.get()!;
    return this.prisma.scoped.brand.create({ data: { ...dto, createdBy: ctx.userId } });
  }
}
