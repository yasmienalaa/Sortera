import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Audit } from '../common/audit/audit.decorator';
import { RolesGuard } from '../common/policy/roles.guard';
import { SearchService } from './search.service';
import { SavedSearchesService } from './saved-searches.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { CreateSavedSearchDto } from './dto/create-saved-search.dto';

@Controller()
@UseGuards(RolesGuard)
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly savedSearches: SavedSearchesService,
  ) {}

  @Get('search')
  @Audit('search', 'view')
  search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query);
  }

  @Post('saved-searches')
  @Audit('saved_search', 'create')
  create(@Body() dto: CreateSavedSearchDto) {
    return this.savedSearches.create(dto);
  }

  @Get('saved-searches')
  @Audit('saved_search', 'view')
  listMine() {
    return this.savedSearches.listMine();
  }

  @Post('saved-searches/:id/run')
  @Audit('saved_search', 'run')
  run(@Param('id') id: string) {
    return this.savedSearches.run(id);
  }

  @Delete('saved-searches/:id')
  @Audit('saved_search', 'delete')
  delete(@Param('id') id: string) {
    return this.savedSearches.delete(id);
  }
}
