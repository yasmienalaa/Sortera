import { Controller, Get, UseGuards } from '@nestjs/common';
import { Req } from '@nestjs/common';
import { NavSectionsService } from './nav-sections.service';
import { RolesGuard } from '../common/policy/roles.guard';
import { AuthedRequest } from '../common/tenant-context/tenant.middleware';

@Controller('nav-sections')
@UseGuards(RolesGuard)
export class NavSectionsController {
  constructor(private readonly service: NavSectionsService) {}

  @Get()
  get(@Req() req: AuthedRequest) {
    return this.service.forCurrentUser(req.user!.role as any);
  }
}
