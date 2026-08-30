import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import {
  GetFacetsDto,
  GetFacetsResponseDto,
  SearchAdvisorsDto,
  SearchAdvisorsResponseDto,
  SearchFacetOptionsDto,
  SearchFacetOptionsResponseDto,
} from './dto/prospecting.dto.js';
import { GetFacetsQuery } from './queries/get-facets.js';
import { SearchAdvisorsQuery } from './queries/search-advisors.js';
import { SearchFacetOptionsQuery } from './queries/search-facet-options.js';

@ApiTags('Prospecting')
@Controller('prospecting')
export class ProspectingController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @ZodResponse({ type: SearchAdvisorsResponseDto })
  @Post('search-advisors')
  async searchAdvisors(@Body() dto: SearchAdvisorsDto) {
    return this.queryBus.execute(new SearchAdvisorsQuery(dto));
  }

  @ZodResponse({ type: GetFacetsResponseDto })
  @Post('facets')
  async getFacets(@Body() dto: GetFacetsDto) {
    return this.queryBus.execute(new GetFacetsQuery(dto));
  }

  @ZodResponse({ type: SearchFacetOptionsResponseDto })
  @Post('facet-options')
  async searchFacetOptions(@Body() dto: SearchFacetOptionsDto) {
    return this.queryBus.execute(new SearchFacetOptionsQuery(dto));
  }
}
