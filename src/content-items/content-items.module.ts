import { Module } from '@nestjs/common';
import { ContentItemsController } from './content-items.controller';
import { ContentItemsService } from './content-items.service';
import { RetentionModule } from '../retention/retention.module';

@Module({
  imports: [RetentionModule],
  controllers: [ContentItemsController],
  providers: [ContentItemsService],
})
export class ContentItemsModule {}
