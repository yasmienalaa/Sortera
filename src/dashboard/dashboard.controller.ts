import { Controller, Get, UseGuards } from '@nestjs/common';
import { Audit } from '../common/audit/audit.decorator';
import { RolesGuard } from '../common/policy/roles.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(RolesGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  @Audit('dashboard', 'view')
  get() {
    return this.service.latestOrCompute();
  }
}
