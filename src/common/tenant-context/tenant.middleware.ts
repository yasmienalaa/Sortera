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
  sid?: string; // ActiveSession id — only present on internal 'access' tokens
  // B3: absent or 'internal' = staff token; 'researcher-portal' = external
  // researcher token. These two audiences are mutually exclusive by path —
  // a researcher-portal token is REJECTED on every internal route and vice
  // versa, which is the actual isolation B3 asks for, not just a naming
  // convention.
  aud?: 'internal' | 'researcher-portal';
}

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/health',
  '/researcher-portal/register',
  '/researcher-portal/login',
];

// Routes a 'pending_2fa' token is allowed to hit — nothing else. This is
// the actual enforcement of A1's "بدون تخطٍ": there is no server-side path
// from a pending token to any protected resource except finishing 2FA.
// A frontend "skip" button, if one still exists, has nothing to skip to.
const PENDING_2FA_ALLOWED_PATHS = ['/auth/2fa/setup', '/auth/2fa/verify'];

/**
 * FIX (found via real end-to-end testing): use req.originalUrl, not
 * req.path. NestJS/Express can mount this middleware such that req.path
 * is resolved relative to the current sub-router — in practice it came
 * back as just "/" for every request regardless of the real route, which
 * silently 401'd every public path (login, health, researcher
 * register/login) and broke the researcher-portal audience check
 * entirely. req.originalUrl stays the full absolute path no matter how
 * deep the routing is nested.
 */
function requestPath(req: Request): string {
  return req.originalUrl.split('?')[0];
}

/**
 * Phase 5 (frontend): plain static HTML/CSS/JS served from the same app
 * (see main.ts's useStaticAssets). None of it carries secrets — the
 * pages themselves just check localStorage for a token client-side and
 * redirect to /login.html if missing — so gating the FILES behind this
 * middleware would be pointless and would break the app on first load
 * (no token exists yet to even reach /login.html). Every actual API
 * call those pages make still goes through the checks below as normal.
 */
function isStaticAssetRequest(path: string): boolean {
  return (
    path === '/' ||
    path.startsWith('/css/') ||
    path.startsWith('/js/') ||
    path.startsWith('/images/') ||
    /\.(html|css|js|map|png|jpg|jpeg|svg|ico|webp|woff2?)$/.test(path)
  );
}

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
 *
 * Phase 4 addition: also the ONE place that enforces the researcher-portal
 * / internal audience split (B3).
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly jwt: JwtService,
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: AuthedRequest, res: Response, next: NextFunction) {
    const path = requestPath(req);

    if (isStaticAssetRequest(path) || PUBLIC_PATHS.some((p) => path.startsWith(p))) {
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

    const isResearcherRoute = path.startsWith('/researcher-portal');
    const isResearcherToken = payload.aud === 'researcher-portal';

    if (isResearcherRoute !== isResearcherToken) {
      // Either a researcher token hitting an internal route, or an
      // internal token hitting the researcher portal — both rejected
      // identically so neither side can even distinguish "wrong audience"
      // from "wrong route" by the error shape.
      throw new UnauthorizedException('Token is not valid for this portal');
    }

    if (isResearcherToken) {
      // Researcher-portal tokens skip 2FA-pending and internal
      // session-revocation checks entirely — those are internal-staff
      // concerns (ActiveSession's FK is to `User`, not `ResearcherAccount`).
      // A parallel researcher-session model is a reasonable follow-up if
      // remote-logout for researchers becomes a requirement; out of scope
      // for this pass.
      req.user = { userId: payload.sub, tenantId: payload.tenantId, role: 'EXTERNAL_RESEARCHER' };
      return this.tenantContext.run(
        {
          tenantId: payload.tenantId,
          userId: payload.sub,
          role: 'EXTERNAL_RESEARCHER',
          ipAddress: req.ip,
          actorType: 'RESEARCHER',
        },
        () => next(),
      );
    }

    if (payload.typ === 'pending_2fa') {
      if (!PENDING_2FA_ALLOWED_PATHS.some((p) => path.startsWith(p))) {
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
        actorType: 'STAFF',
      },
      () => next(),
    );
  }
}
