import { Module } from '@nestjs/common';
import { RetentionPoliciesController } from './retention-policies.controller';
import { RetentionPoliciesService } from './retention-policies.service';
import { RetentionEnforcementService } from './retention-enforcement.service';

@Module({
  controllers: [RetentionPoliciesController],
  providers: [RetentionPoliciesService, RetentionEnforcementService],
  exports: [RetentionPoliciesService],
})
export class RetentionModule {}
