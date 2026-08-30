import { Module } from '@nestjs/common';

// plop:imports
import { SearchFacetOptionsQueryHandler } from './queries/search-facet-options.js';
import { GetFacetsQueryHandler } from './queries/get-facets.js';
import { SearchAdvisorsQueryHandler } from './queries/search-advisors.js';
import { ProspectingController } from './prospecting.controller.js';

@Module({
  controllers: [ProspectingController],
  providers: [
    // plop:providers
    SearchFacetOptionsQueryHandler,
    GetFacetsQueryHandler,
    SearchAdvisorsQueryHandler,
  ],
})
export class ProspectingModule {}
