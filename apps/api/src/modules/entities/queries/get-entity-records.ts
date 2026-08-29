import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { readCellsForRecords, readEdgesForRecords } from '@feature/entities/cells/page-hydrator.js';
import {
  buildGridCountQuery,
  buildGridPageQuery,
} from '@feature/entities/grid/grid-query.builder.js';
import type { AttributeMeta } from '@feature/entities/relationship-edges.js';
import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import type { GetEntityRecordsDto, GetEntityRecordsResponseDto } from '../dto/entities.dto.js';

export class GetEntityRecordsQuery extends Query<GetEntityRecordsResponseDto> {
  constructor(public readonly dto: GetEntityRecordsDto) {
    super();
  }
}

type PageRow = { id: string; source_crd: string | null };

@QueryHandler(GetEntityRecordsQuery)
export class GetEntityRecordsQueryHandler implements IQueryHandler<GetEntityRecordsQuery> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute({ dto }: GetEntityRecordsQuery): Promise<GetEntityRecordsResponseDto> {
    const workspaceId = this.alsService.ctx.get('workspaceId');

    if (!workspaceId) {
      throw new ForbiddenException('No active workspace for this session');
    }

    // scoping the entity lookup by workspace is what stops a cross-tenant read
    const entity = await this.appPrismaService.entity.findFirst({
      where: { id: dto.entityId, workspaceId },
      select: { id: true, sourceKind: true },
    });

    if (!entity) {
      throw new NotFoundException('Entity not found');
    }

    const attributes = await this.appPrismaService.entityAttribute.findMany({
      where: { entityId: entity.id, workspaceId },
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

    const attributesById = new Map<string, AttributeMeta>(
      attributes.map((a) => [a.id, a satisfies AttributeMeta]),
    );

    const shared = {
      workspaceId,
      entityId: entity.id,
      sourceKind: entity.sourceKind,
      attributesById,
      filter: dto.filter,
    };

    const page = buildGridPageQuery({
      ...shared,
      sort: dto.sort,
      limit: dto.limit,
      offset: dto.offset,
    });
    const count = buildGridCountQuery(shared);

    const [rows, totals] = await Promise.all([
      this.appPrismaService.$queryRawUnsafe<PageRow[]>(page.sql, ...page.params),
      this.appPrismaService.$queryRawUnsafe<{ total: bigint }[]>(count.sql, ...count.params),
    ]);

    const recordIds = rows.map((row) => row.id);

    const [cells, edges] = await Promise.all([
      readCellsForRecords(this.executor, recordIds, workspaceId),
      readEdgesForRecords(this.executor, recordIds, workspaceId),
    ]);

    return {
      records: rows.map((row) => ({
        id: row.id,
        // bigint does not survive JSON, and a CRD is an identifier not a number
        sourceCrd: row.source_crd === null ? null : String(row.source_crd),
        cells: cells.get(row.id) ?? [],
        edges: edges.get(row.id) ?? [],
      })),
      total: Number(totals[0]?.total ?? 0),
      limit: dto.limit,
      offset: dto.offset,
    };
  }

  /** adapts prisma's raw interface to the hydrator's narrow executor */
  private get executor() {
    return {
      query: async <T>(sql: string, params: unknown[]): Promise<{ rows: T[] }> => ({
        rows: await this.appPrismaService.$queryRawUnsafe<T[]>(sql, ...params),
      }),
    };
  }
}
