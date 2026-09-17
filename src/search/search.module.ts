import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SavedSearchesService } from './saved-searches.service';

@Module({
  controllers: [SearchController],
  providers: [SearchService, SavedSearchesService],
  exports: [SearchService],
})
export class SearchModule {}
