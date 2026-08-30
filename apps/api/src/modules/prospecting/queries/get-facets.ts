import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { buildFacetDefinitions } from '@feature/prospecting/facets/facet-definitions.js';
import {
  attachOptions,
  buildOptionQuery,
} from '@feature/prospecting/facets/facet-options.js';
import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import type {
  GetFacetsDto,
  GetFacetsResponseDto,
} from '../dto/prospecting.dto.js';

export class GetFacetsQuery extends Query<GetFacetsResponseDto> {
  constructor(public readonly dto: GetFacetsDto) {
    super();
  }
}

type OptionRow = { k: number; value: string; label: string };

@QueryHandler(GetFacetsQuery)
export class GetFacetsQueryHandler implements IQueryHandler<GetFacetsQuery> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute({ dto }: GetFacetsQuery): Promise<GetFacetsResponseDto> {
    const workspaceId = this.alsService.ctx.get('workspaceId');

    if (!workspaceId) {
      throw new ForbiddenException('No active workspace for this session');
    }

    const entity = await this.appPrismaService.entity.findFirst({
      where: { workspaceId, sourceKind: dto.sourceKind },
      select: { id: true },
    });

    if (!entity) {
      throw new NotFoundException(
        `No ${dto.sourceKind} entity in this workspace`,
      );
    }

    const attributes = await this.appPrismaService.entityAttribute.findMany({
      where: {
        entityId: entity.id,
        workspaceId,
        isArchived: false,
        referenceColumn: { not: null },
      },
      select: { id: true, label: true, icon: true, referenceColumn: true },
      orderBy: { label: 'asc' },
    });

    const facets = buildFacetDefinitions(attributes);
    const optionQuery = buildOptionQuery(facets);

    if (!optionQuery) {
      return { facets };
    }

    const rows = await this.appPrismaService.$queryRawUnsafe<OptionRow[]>(
      optionQuery.sql,
    );

    return { facets: attachOptions(facets, rows, optionQuery.keys) };
  }
}
