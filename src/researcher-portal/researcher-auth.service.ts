import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterResearcherDto } from './dto/register-researcher.dto';
import { ResearcherLoginDto } from './dto/researcher-login.dto';

@Injectable()
export class ResearcherAuthService {
  constructor(
    // Raw (unscoped) client throughout this service — same justified
    // reason as the internal AuthService: tenant isn't known yet at
    // register/login time, it's exactly what's being resolved.
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterResearcherDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: dto.tenantSlug } });
    if (!tenant) throw new BadRequestException('Unknown archive');

    const existing = await this.prisma.researcherAccount.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: dto.email } },
    });
    if (existing) throw new BadRequestException('An account with this email already exists for this archive');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const account = await this.prisma.researcherAccount.create({
      data: { tenantId: tenant.id, email: dto.email, passwordHash, fullName: dto.fullName },
    });

    return this.issueToken(account);
  }

  async login(dto: ResearcherLoginDto) {
    // Same multi-tenant-same-email disambiguation pattern as the internal
    // AuthService: email is unique per tenant, not globally.
    const candidates = await this.prisma.researcherAccount.findMany({
      where: { email: dto.email, isActive: true },
    });
    for (const candidate of candidates) {
      if (await bcrypt.compare(dto.password, candidate.passwordHash)) {
        return this.issueToken(candidate);
      }
    }
    throw new UnauthorizedException('Invalid email or password');
  }

  private issueToken(account: { id: string; tenantId: string; email: string; fullName: string }) {
    const accessToken = this.jwt.sign({
      sub: account.id,
      tenantId: account.tenantId,
      role: 'EXTERNAL_RESEARCHER',
      typ: 'access',
      aud: 'researcher-portal',
    });
    return {
      accessToken,
      researcher: { id: account.id, email: account.email, fullName: account.fullName },
    };
  }
}
