import { Module } from '@nestjs/common';
import { SharedResourcesController } from './shared-resources.controller';
import { SharedResourcesService } from './shared-resources.service';

@Module({
  controllers: [SharedResourcesController],
  providers: [SharedResourcesService],
})
export class SharingModule {}
