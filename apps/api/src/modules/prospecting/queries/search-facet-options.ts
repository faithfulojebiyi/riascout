import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { resolveReferenceColumn } from '@feature/entities/attribute-types/reference-columns.js';
import { SEARCH_OPTIONS_SQL } from '@feature/prospecting/facets/facet-options.js';
import { AppPrismaService } from '@system/database/database.service.js';

import type {
  SearchFacetOptionsDto,
  SearchFacetOptionsResponseDto,
} from '../dto/prospecting.dto.js';

export class SearchFacetOptionsQuery extends Query<SearchFacetOptionsResponseDto> {
  constructor(public readonly dto: SearchFacetOptionsDto) {
    super();
  }
}

@QueryHandler(SearchFacetOptionsQuery)
export class SearchFacetOptionsQueryHandler implements IQueryHandler<SearchFacetOptionsQuery> {
  constructor(private readonly appPrismaService: AppPrismaService) {}

  async execute({
    dto,
  }: SearchFacetOptionsQuery): Promise<SearchFacetOptionsResponseDto> {
    /**
     * The key is checked against the allowlist even though it only ever reaches
     * SQL as a bound parameter — an unknown key is a client bug worth surfacing
     * rather than an empty result that looks like no matches.
     */
    if (!resolveReferenceColumn(dto.allowKey)) {
      throw new BadRequestException(`Unknown column: ${dto.allowKey}`);
    }

    // options are global reference data, so no workspace scoping applies
    const options = await this.appPrismaService.$queryRawUnsafe<
      { value: string; label: string }[]
    >(
      SEARCH_OPTIONS_SQL,
      dto.allowKey,
      `%${dto.query}%`,
      `${dto.query}%`,
      dto.limit,
    );

    return { options };
  }
}
