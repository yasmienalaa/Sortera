import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/tenant-context/tenant-context.service';
import { CreateCharacterDto } from './dto/create-character.dto';

@Injectable()
export class CharactersService {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  list(search?: string) {
    return this.prisma.scoped.character.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  create(dto: CreateCharacterDto) {
    const ctx = this.tenantContext.get()!;
    return this.prisma.scoped.character.create({
      data: {
        ...dto,
        tenantId: ctx.tenantId,
        createdBy: ctx.userId,
      },
    });
  }
}
