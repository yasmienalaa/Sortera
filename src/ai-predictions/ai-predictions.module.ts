import { Module } from '@nestjs/common';
import { AiPredictionsController } from './ai-predictions.controller';
import { AiPredictionsService } from './ai-predictions.service';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [SearchModule],
  controllers: [AiPredictionsController],
  providers: [AiPredictionsService],
})
export class AiPredictionsModule {}
