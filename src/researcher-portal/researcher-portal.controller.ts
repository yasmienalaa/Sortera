import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Audit } from '../common/audit/audit.decorator';
import { ResearcherAuthService } from './researcher-auth.service';
import { ResearcherPortalService } from './researcher-portal.service';
import { RegisterResearcherDto } from './dto/register-researcher.dto';
import { ResearcherLoginDto } from './dto/researcher-login.dto';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';

// No RolesGuard here on purpose — this portal's authorization is entirely
// access_requests-driven (checked inside ResearcherPortalService on every
// call), not role-based. The internal RBAC/PolicyService machinery is
// deliberately not reused here — see the schema comment on
// ResearcherAccount for why that separation matters for B3.
@Controller('researcher-portal')
export class ResearcherPortalController {
  constructor(
    private readonly authService: ResearcherAuthService,
    private readonly portalService: ResearcherPortalService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterResearcherDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: ResearcherLoginDto) {
    return this.authService.login(dto);
  }

  @Get('content-items')
  @Audit('researcher_portal', 'browse')
  browse() {
    return this.portalService.browse();
  }

  @Post('access-requests')
  @Audit('researcher_portal', 'request_access')
  requestAccess(@Body() dto: CreateAccessRequestDto) {
    return this.portalService.requestAccess(dto);
  }

  @Get('access-requests')
  @Audit('researcher_portal', 'view')
  listMyRequests() {
    return this.portalService.listMyRequests();
  }

  @Get('content-items/:id')
  @Audit('researcher_portal', 'view')
  view(@Param('id') id: string) {
    return this.portalService.view(id);
  }

  @Post('content-items/:id/download')
  @Audit('researcher_portal', 'download')
  requestDownload(@Param('id') id: string) {
    return this.portalService.requestDownload(id);
  }

  @Get('watermark-jobs/:id')
  @Audit('researcher_portal', 'view')
  getWatermarkJob(@Param('id') id: string) {
    return this.portalService.getWatermarkJob(id);
  }
}
