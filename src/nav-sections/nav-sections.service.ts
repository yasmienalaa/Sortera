import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NavSectionsService {
  constructor(private readonly prisma: PrismaService) {}

  // A3: returns the sidebar grouping for the current tenant + role,
  // configured via the nav_sections table instead of hardcoded in the
  // frontend. Sections with role=null apply to everyone in the tenant;
  // role-specific sections are added on top (allowing e.g. a government
  // tenant to simply never create a "الشخصيات/العلامات" section at all).
  async forCurrentUser(role: Role) {
    const sections = await this.prisma.scoped.navSection.findMany({
      where: { OR: [{ role: null }, { role }] },
      orderBy: { sortOrder: 'asc' },
    });
    return sections;
  }
}
