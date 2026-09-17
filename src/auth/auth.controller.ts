import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { ActiveSessionsService } from './active-sessions.service';
import { LoginDto } from './dto/login.dto';
import { VerifyTwoFactorDto } from './dto/verify-two-factor.dto';
import { AuthedRequest } from '../common/tenant-context/tenant.middleware';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionsService: ActiveSessionsService,
  ) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, { ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  }

  // Bearer auth here is the 'pending_2fa' token returned by /auth/login —
  // TenantMiddleware allows exactly this path (and /auth/2fa/verify) for
  // that token type, and nothing else.
  @Post('2fa/setup')
  setupTwoFactor(@Req() req: AuthedRequest) {
    return this.authService.setupTwoFactor(req.user!.userId);
  }

  @Post('2fa/verify')
  verifyTwoFactor(@Body() dto: VerifyTwoFactorDto, @Req() req: AuthedRequest) {
    return this.authService.verifyTwoFactor(req.user!.userId, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // A12 — session management. Full access token required (not pending).
  @Get('sessions')
  listSessions(@Req() req: AuthedRequest) {
    return this.sessionsService.listMine(req.user!.userId);
  }

  @Delete('sessions/:id')
  revokeSession(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.sessionsService.revoke(req.user!.userId, id);
  }
}
