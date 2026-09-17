import { Module } from '@nestjs/common';
import { MergeSuggestionsController } from './merge-suggestions.controller';
import { MergeSuggestionsService } from './merge-suggestions.service';

@Module({
  controllers: [MergeSuggestionsController],
  providers: [MergeSuggestionsService],
})
export class MergeSuggestionsModule {}
