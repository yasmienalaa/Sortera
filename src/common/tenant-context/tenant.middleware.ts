import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';
import { TenantContextService } from './tenant-context.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuthedRequest extends Request {
  user?: { userId: string; tenantId: string; role: string };
}

interface JwtPayload {
  sub: string;
  tenantId: string;
  role: string;
  typ: 'access' | 'pending_2fa';
  sid?: string; // ActiveSession id — only present on 'access' tokens
}

const PUBLIC_PATHS = ['/auth/login', '/health'];

// Routes a 'pending_2fa' token is allowed to hit — nothing else. This is
// the actual enforcement of A1's "بدون تخطٍ": there is no server-side path
// from a pending token to any protected resource except finishing 2FA.
// A frontend "skip" button, if one still exists, has nothing to skip to.
const PENDING_2FA_ALLOWED_PATHS = ['/auth/2fa/setup', '/auth/2fa/verify'];

/**
 * Runs before every guard/controller. This is the "middleware مركزي"
 * required by instruction #4 and by C4 in the spec: it is the ONE place
 * that resolves tenantId for a request, and every downstream Prisma query
 * reads it from here — no controller/service can "forget" to scope by
 * tenant, because they never see tenantId as a parameter they could
 * mishandle in the first place.
 *
 * Phase 2 additions: also the ONE place that enforces "2FA verified" (A1)
 * and "session not revoked" (A12) — both are request-lifecycle concerns,
 * not per-endpoint ones, for the same "can't be forgotten" reasoning.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly jwt: JwtService,
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: AuthedRequest, res: Response, next: NextFunction) {
    if (PUBLIC_PATHS.some((p) => req.path.startsWith(p))) {
      return next();
    }

    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: JwtPayload;
    try {
      payload = this.jwt.verify(header.slice('Bearer '.length));
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.typ === 'pending_2fa') {
      if (!PENDING_2FA_ALLOWED_PATHS.some((p) => req.path.startsWith(p))) {
        throw new UnauthorizedException('Two-factor verification required');
      }
    } else {
      // Full access token — confirm the session behind it hasn't been
      // revoked (A12: "logout from this device" / admin-forced logout).
      // Uses the RAW client with an explicit tenantId filter, not
      // `.scoped`, because the tenant context this whole check exists to
      // populate doesn't exist yet at this point in the pipeline — same
      // justified-bypass category as login. See prisma.service.ts.
      if (payload.sid) {
        const session = await this.prisma.activeSession.findFirst({
          where: { id: payload.sid, tenantId: payload.tenantId },
        });
        if (!session) {
          throw new UnauthorizedException('Session has been revoked');
        }
        // Fire-and-forget freshness update — not worth awaiting/blocking
        // the request on.
        void this.prisma.activeSession.update({
          where: { id: session.id },
          data: { lastActive: new Date() },
        });
      }
    }

    req.user = {
      userId: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
    };

    // Everything downstream of next() — guards, interceptors, the
    // controller, and crucially every Prisma call made while handling
    // this request — runs inside this context.
    return this.tenantContext.run(
      {
        tenantId: payload.tenantId,
        userId: payload.sub,
        role: payload.role,
        ipAddress: req.ip,
      },
      () => next(),
    );
  }
}
