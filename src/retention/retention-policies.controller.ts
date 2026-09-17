import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Audit } from '../common/audit/audit.decorator';
import { Roles, RolesGuard } from '../common/policy/roles.guard';
import { RetentionPoliciesService } from './retention-policies.service';
import { CreateRetentionPolicyDto } from './dto/create-retention-policy.dto';

@Controller('retention-policies')
@UseGuards(RolesGuard)
export class RetentionPoliciesController {
  constructor(private readonly service: RetentionPoliciesService) {}

  @Get()
  @Audit('retention_policy', 'view')
  list() {
    return this.service.list();
  }

  @Post()
  @Roles('OWNER', 'SUPER_ADMIN')
  @Audit('retention_policy', 'create')
  upsert(@Body() dto: CreateRetentionPolicyDto) {
    return this.service.upsert(dto);
  }
}
