import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { RetentionModule } from '../retention/retention.module';

@Module({
  imports: [RetentionModule],
  controllers: [MediaController],
  providers: [MediaService],
})
export class MediaModule {}
