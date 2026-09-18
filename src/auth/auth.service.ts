import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/tenant-context/tenant-context.service';
import { AuditService } from '../common/audit/audit.service';
import { RateLimitService } from '../common/rate-limit/rate-limit.service';
import { NotificationService } from '../notifications/notification.service';
import { TwoFactorService } from './two-factor.service';
import { LoginDto } from './dto/login.dto';
import { VerifyTwoFactorDto } from './dto/verify-two-factor.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const LOGIN_LIMIT = 8;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const DEVICE_TRUST_DAYS = 30;

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    // Note: uses the BASE (unscoped) PrismaClient methods here — e.g.
    // `this.prisma.user.findMany` NOT `this.prisma.scoped.user...` — since
    // at login time we don't know the tenant yet; that's exactly what
    // we're resolving. This, plus the session-revocation check in
    // TenantMiddleware, are the only two sanctioned bypasses of the
    // mandatory-tenant-scoping extension in the whole app.
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly tenantContext: TenantContextService,
    private readonly auditService: AuditService,
    private readonly rateLimit: RateLimitService,
    private readonly twoFactor: TwoFactorService,
    private readonly notifications: NotificationService,
  ) {}

  async login(dto: LoginDto, meta: RequestMeta) {
    // A1: Redis token-bucket-ish rate limiting on both the email and the
    // IP, so an attacker can't work around a per-account limit by
    // rotating accounts from one IP, or a per-IP limit by rotating IPs
    // against one account.
    const emailOk = await this.rateLimit.consume(`login-email:${dto.email}`, LOGIN_LIMIT, LOGIN_WINDOW_SECONDS);
    const ipOk = meta.ipAddress
      ? await this.rateLimit.consume(`login-ip:${meta.ipAddress}`, LOGIN_LIMIT * 3, LOGIN_WINDOW_SECONDS)
      : true;
    if (!emailOk || !ipOk) {
      throw new UnauthorizedException('Too many login attempts. Try again later.');
    }

    // Email is unique per-tenant, not globally (see schema.prisma), so the
    // same address can legitimately exist under more than one customer.
    // We disambiguate by finding which tenant's copy actually matches the
    // password.
    const candidates = await this.prisma.user.findMany({
      where: { email: dto.email, isActive: true },
    });

    let matched: (typeof candidates)[number] | undefined;
    for (const candidate of candidates) {
      if (await bcrypt.compare(dto.password, candidate.passwordHash)) {
        matched = candidate;
        break;
      }
    }

    if (!matched) {
      // We deliberately don't know a tenantId here, so this failed
      // attempt can't be written as a normal tenant-scoped audit row.
      // A dedicated tenant-less "security_events" sink for pre-auth
      // failures (with device fingerprint) is a reasonable Phase 3+
      // addition; flagging it rather than silently skipping the log.
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.rateLimit.reset(`login-email:${dto.email}`);

    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: matched.tenantId } });
    const requiresTwoFactor = tenant.enforceTwoFactorForRoles.includes(matched.role);

    if (requiresTwoFactor) {
      const trustedSession = dto.deviceToken
        ? await this.checkTrustedDevice(dto.deviceToken, matched.id)
        : null;

      if (!trustedSession) {
        // No skip button on the server side: this is the ONLY thing
        // login returns for a role that requires 2FA and has no valid
        // trusted-device token. There is no code path that hands out a
        // usable access token from here — see TenantMiddleware for how
        // a 'pending_2fa' token is boxed in.
        const tempToken = this.jwt.sign(
          { sub: matched.id, tenantId: matched.tenantId, role: matched.role, typ: 'pending_2fa' },
          { expiresIn: '10m' },
        );
        return {
          requiresTwoFactor: true,
          twoFactorSetupRequired: !matched.twoFactorEnabled,
          tempToken,
        };
      }

      // Trusted device — skip straight to a full session, but still touch
      // it so "last active" reflects reality.
      return this.issueFullSession(matched, meta, trustedSession.id);
    }

    return this.issueFullSession(matched, meta);
  }

  /**
   * Called from POST /auth/2fa/setup (pending token as bearer auth).
   * Generates and stores a TOTP secret — NOT yet enabled until the user
   * proves they can generate a valid code for it via verifyTwoFactor().
   */
  async setupTwoFactor(userId: string) {
    const secret = this.twoFactor.generateSecret();
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });
    return { otpauthUrl: this.twoFactor.keyUri(user.email, secret), secret };
  }

  /**
   * Called from POST /auth/2fa/verify (pending token as bearer auth).
   * Verifies the TOTP code, flips twoFactorEnabled on first success,
   * issues the full access token, and — if rememberDevice was requested —
   * a long-lived deviceToken the client can replay at future logins to
   * skip this step (a real, auditable alternative to the old "تخطي
   * المصادقة" button, not a reintroduction of it).
   */
  async verifyTwoFactor(userId: string, dto: VerifyTwoFactorDto, meta: RequestMeta) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorSecret) {
      throw new UnauthorizedException('Two-factor has not been set up yet — call /auth/2fa/setup first.');
    }
    if (!this.twoFactor.verify(dto.code, user.twoFactorSecret)) {
      throw new UnauthorizedException('Invalid verification code');
    }

    if (!user.twoFactorEnabled) {
      await this.prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
    }

    const trustedUntil = dto.rememberDevice
      ? new Date(Date.now() + DEVICE_TRUST_DAYS * 24 * 60 * 60 * 1000)
      : null;

    const session = await this.createSession(user, meta, trustedUntil);

    let deviceToken: string | undefined;
    if (dto.rememberDevice) {
      deviceToken = this.jwt.sign(
        { sub: user.id, sid: session.id, typ: 'device_trust' },
        { expiresIn: `${DEVICE_TRUST_DAYS}d` },
      );
    }

    const accessToken = this.signAccessToken(user, session.id);

    await this.tenantContext.run(
      { tenantId: user.tenantId, userId: user.id, role: user.role, ipAddress: meta.ipAddress, actorType: 'STAFF' },
      () =>
        this.auditService.record({
          actionType: 'auth.two_factor_verified',
          resourceType: 'auth',
          resourceId: user.id,
          metadata: { rememberDevice: !!dto.rememberDevice },
        }),
    );

    return {
      accessToken,
      deviceToken,
      user: this.publicUser(user),
    };
  }

  private async checkTrustedDevice(deviceToken: string, expectedUserId: string) {
    try {
      const payload = this.jwt.verify<{ sub: string; sid: string; typ: string }>(deviceToken);
      if (payload.typ !== 'device_trust' || payload.sub !== expectedUserId) return null;
      const session = await this.prisma.activeSession.findFirst({
        where: { id: payload.sid, userId: expectedUserId },
      });
      if (!session?.twoFactorTrustedUntil || session.twoFactorTrustedUntil < new Date()) {
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  private async createSession(
    user: { id: string; tenantId: string },
    meta: RequestMeta,
    twoFactorTrustedUntil: Date | null,
  ) {
    return this.prisma.activeSession.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        deviceInfo: meta.userAgent,
        ip: meta.ipAddress,
        // Not a meaningful secret on its own (the JWT signature is what
        // actually protects the session) — kept to satisfy the appendix's
        // session_token_hash column, and as a stable per-session opaque
        // value if a client ever needs to display "this session" without
        // exposing the JWT itself.
        sessionTokenHash: crypto.randomBytes(16).toString('hex'),
        twoFactorTrustedUntil,
      },
    });
  }

  private signAccessToken(user: { id: string; tenantId: string; role: string }, sessionId: string) {
    return this.jwt.sign({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      typ: 'access',
      sid: sessionId,
    });
  }

  private async issueFullSession(
    user: { id: string; tenantId: string; role: string; email: string; fullName: string },
    meta: RequestMeta,
    existingSessionId?: string,
  ) {
    const session = existingSessionId
      ? { id: existingSessionId }
      : await this.createSession(user, meta, null);

    const accessToken = this.signAccessToken(user, session.id);

    await this.tenantContext.run(
      { tenantId: user.tenantId, userId: user.id, role: user.role, ipAddress: meta.ipAddress, actorType: 'STAFF' },
      () =>
        this.auditService.record({
          actionType: 'auth.login',
          resourceType: 'auth',
          resourceId: user.id,
          metadata: { outcome: 'success' },
        }),
    );

    return { accessToken, user: this.publicUser(user) };
  }

  /**
   * Deliberately does NOT reveal whether the email exists — always
   * returns the same generic response, and the rate limiter (same one
   * login uses) caps how many times an attacker can even probe.
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const ok = await this.rateLimit.consume(`forgot-password:${dto.email}`, 5, 15 * 60);
    if (!ok) return { message: 'لو الإيميل ده مسجّل، هيوصلك رابط إعادة تعيين.' };

    const candidates = await this.prisma.user.findMany({ where: { email: dto.email, isActive: true } });

    for (const user of candidates) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      });
      const resetUrl = `${process.env.APP_BASE_URL ?? ''}/reset-password.html?token=${rawToken}`;
      await this.notifications.sendPasswordReset(user.email, resetUrl);
    }

    // Same message regardless of whether `candidates` was empty — see
    // the no-disclosure note above.
    return { message: 'لو الإيميل ده مسجّل، هيوصلك رابط إعادة تعيين.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { gt: new Date() } },
    });
    if (!user) throw new UnauthorizedException('الرابط غير صالح أو منتهي الصلاحية');

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetTokenHash: null, passwordResetExpiresAt: null },
    });

    // Reset also revokes every existing session for this user — a
    // credential compromise scenario (which is exactly when someone
    // resets a password) shouldn't leave old sessions valid.
    await this.prisma.activeSession.deleteMany({ where: { userId: user.id } });

    await this.tenantContext.run(
      { tenantId: user.tenantId, userId: user.id, role: user.role, actorType: 'STAFF' },
      () =>
        this.auditService.record({
          actionType: 'auth.password_reset',
          resourceType: 'auth',
          resourceId: user.id,
        }),
    );

    return { message: 'تم تغيير كلمة المرور بنجاح' };
  }

  private publicUser(user: { id: string; tenantId: string; email: string; fullName: string; role: string }) {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
  }
}
