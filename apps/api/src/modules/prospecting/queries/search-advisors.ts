import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { unresolvableAttributeIds } from '@feature/prospecting/search/assert-resolvable.js';
import {
  buildProspectSearchQuery,
  REFERENCE_PREFIX,
} from '@feature/prospecting/search/prospect-query.builder.js';
import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import type {
  SearchAdvisorsDto,
  SearchAdvisorsResponseDto,
} from '../dto/prospecting.dto.js';

export class SearchAdvisorsQuery extends Query<SearchAdvisorsResponseDto> {
  constructor(public readonly dto: SearchAdvisorsDto) {
    super();
  }
}

/** CRDs are bigint in postgres and JSON has no bigint; they are identifiers
 *  rather than quantities, so they cross the boundary as strings */
const toJsonValue = (value: unknown): unknown => {
  if (typeof value === 'bigint') return String(value);
  if (Array.isArray(value)) return value.map(toJsonValue);

  return value;
};

type ProspectRow = Record<string, unknown> & {
  source_crd: bigint | string;
  record_id: string | null;
  total_count: bigint | number;
};

@QueryHandler(SearchAdvisorsQuery)
export class SearchAdvisorsQueryHandler implements IQueryHandler<SearchAdvisorsQuery> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute({
    dto,
  }: SearchAdvisorsQuery): Promise<SearchAdvisorsResponseDto> {
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
      where: { entityId: entity.id, workspaceId, isArchived: false },
      select: {
        id: true,
        entityId: true,
        type: true,
        isMultiValue: true,
        relationshipType: true,
        isCanonicalSide: true,
        otherRelationshipSideAttributeId: true,
        referenceColumn: true,
      },
    });

    const attributesById = new Map(attributes.map((a) => [a.id, a]));
    const unresolvable = unresolvableAttributeIds(
      dto.filter,
      new Set(attributesById.keys()),
    );

    if (unresolvable.length > 0) {
      throw new BadRequestException(
        `Unknown attribute(s) in filter: ${unresolvable.join(', ')}`,
      );
    }

    const { sql, params } = buildProspectSearchQuery({
      workspaceId,
      entityId: entity.id,
      sourceKind: dto.sourceKind,
      attributesById,
      filter: dto.filter,
      sort: dto.sort,
      selectAttributeIds: dto.selectAttributeIds,
      limit: dto.limit,
      offset: dto.offset,
    });

    const rows = await this.appPrismaService.$queryRawUnsafe<ProspectRow[]>(
      sql,
      ...params,
    );

    return {
      // the window function repeats the total on every row, so an empty page
      // legitimately has no total to read
      total: rows.length > 0 ? Number(rows[0]?.total_count ?? 0) : 0,
      limit: dto.limit,
      offset: dto.offset,
      rows: rows.map((row) => ({
        sourceCrd: String(row.source_crd),
        recordId: row.record_id,
        values: Object.entries(row)
          .filter(([key]) => key.startsWith(REFERENCE_PREFIX))
          .map(([key, value]) => ({
            attributeId: key.slice(REFERENCE_PREFIX.length),
            value: toJsonValue(value),
          })),
      })),
    };
  }
}
