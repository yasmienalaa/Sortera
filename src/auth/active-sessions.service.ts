import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActiveSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  listMine(userId: string) {
    // .scoped injects tenantId automatically; userId narrows to this user's
    // own sessions specifically.
    return this.prisma.scoped.activeSession.findMany({
      where: { userId },
      orderBy: { lastActive: 'desc' },
    });
  }

  async revoke(userId: string, sessionId: string) {
    const session = await this.prisma.scoped.activeSession.findFirst({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId) {
      throw new ForbiddenException("You can only revoke your own sessions.");
    }
    // Deleting the row IS the revocation — TenantMiddleware treats a
    // missing ActiveSession as "this access token is dead" on the very
    // next request that uses it, even though the JWT itself hasn't
    // expired yet.
    await this.prisma.scoped.activeSession.delete({ where: { id: sessionId } });
    return { revoked: true };
  }
}
