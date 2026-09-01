import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import {
  readCellsForRecords,
  readEdgesForRecords,
} from '@feature/entities/cells/page-hydrator.js';
import {
  buildGridCountQuery,
  buildGridPageQuery,
  REFERENCE_PREFIX,
} from '@feature/entities/grid/grid-query.builder.js';
import type { AttributeMeta } from '@feature/entities/relationship-edges.js';
import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import type { FilterTree, SortAst } from '@feature/entities/filter-sort/ast.js';
import type {
  GetEntityRecordsDto,
  GetEntityRecordsResponseDto,
} from '../dto/entities.dto.js';

/** above this a vocabulary is a lookup, not a set of labels */
const CODE_VOCABULARY_MAX = 64;

export class GetEntityRecordsQuery extends Query<GetEntityRecordsResponseDto> {
  constructor(public readonly dto: GetEntityRecordsDto) {
    super();
  }
}

type PageRow = { id: string; source_crd: string | null } & Record<
  string,
  unknown
>;

/**
 * CRDs are bigint in postgres and JSON has no bigint. They are identifiers
 * rather than quantities, so they cross the boundary as strings — a number
 * would silently lose precision above 2^53 and invite arithmetic besides.
 */
const toJsonValue = (value: unknown): unknown => {
  if (typeof value === 'bigint') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(toJsonValue);
  }

  return value;
};

@QueryHandler(GetEntityRecordsQuery)
export class GetEntityRecordsQueryHandler implements IQueryHandler<GetEntityRecordsQuery> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute({
    dto,
  }: GetEntityRecordsQuery): Promise<GetEntityRecordsResponseDto> {
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
        label: true,
        icon: true,
        group: true,
        isEditable: true,
        choices: {
          select: { id: true, name: true, color: true },
          orderBy: { position: 'asc' },
        },
      },
    });

    const attributesById = new Map<string, AttributeMeta>(
      attributes.map((a) => [a.id, a satisfies AttributeMeta]),
    );

    const optionsByKey = await this.readCodeVocabularies(attributes);

    const view = await this.loadView(
      dto,
      entity.id,
      workspaceId,
      attributes,
      optionsByKey,
    );

    /**
     * A request filter replaces the view's rather than merging: intersecting a
     * saved filter with an ad-hoc one gives results neither asked for, and the
     * user cannot see why a row is missing.
     */
    const filter =
      dto.filter ?? (view?.filterTree as FilterTree | null) ?? null;
    const sort =
      dto.sort.length > 0 ? dto.sort : ((view?.sort as SortAst | null) ?? []);

    const shared = {
      workspaceId,
      entityId: entity.id,
      sourceKind: entity.sourceKind,
      attributesById,
      filter,
      listId: dto.listId,
    };

    const requestedFields = new Set(dto.visibleFieldIds);

    /** projected columns are selected on the page query, not hydrated as cells */
    const referenceAttributeIds = (view?.summary.fields ?? [])
      .filter((f) => f.isVisible && !f.lazy)
      .filter(
        (f) => requestedFields.size === 0 || requestedFields.has(f.fieldId),
      )
      .map((f) => f.attributeId)
      .filter((id) => attributesById.get(id)?.referenceColumn !== null);

    const page = buildGridPageQuery({
      ...shared,
      sort,
      limit: dto.limit,
      offset: dto.offset,
      referenceAttributeIds,
    });
    const count = buildGridCountQuery(shared);

    const [rows, totals] = await Promise.all([
      this.appPrismaService.$queryRawUnsafe<PageRow[]>(
        page.sql,
        ...page.params,
      ),
      this.appPrismaService.$queryRawUnsafe<{ total: bigint }[]>(
        count.sql,
        ...count.params,
      ),
    ]);

    const recordIds = rows.map((row) => row.id);

    /**
     * Only columns the grid will paint are fetched. lazy fields are excluded
     * too — the cell renderer asks for those on demand rather than making
     * every page carry them.
     */
    const fetchAttributeIds = view?.summary.fields
      .filter((f) => f.isVisible && !f.lazy)
      .filter(
        (f) => requestedFields.size === 0 || requestedFields.has(f.fieldId),
      )
      .map((f) => f.attributeId);

    const [cells, edges] = await Promise.all([
      readCellsForRecords(
        this.executor,
        recordIds,
        workspaceId,
        fetchAttributeIds,
      ),
      readEdgesForRecords(
        this.executor,
        recordIds,
        workspaceId,
        fetchAttributeIds,
      ),
    ]);

    return {
      view: view?.summary ?? null,
      records: rows.map((row) => ({
        id: row.id,
        // bigint does not survive JSON, and a CRD is an identifier not a number
        sourceCrd: row.source_crd === null ? null : String(row.source_crd),
        cells: [
          ...(cells.get(row.id) ?? []),
          // a projected value is read-only, so it carries no version to edit against
          ...referenceAttributeIds.flatMap((attributeId) => {
            const value = row[`${REFERENCE_PREFIX}${attributeId}`];

            return value === undefined || value === null
              ? []
              : [
                  {
                    attributeId,
                    value: toJsonValue(value),
                    source: 'market',
                    version: 0,
                  },
                ];
          }),
        ],
        edges: edges.get(row.id) ?? [],
      })),
      total: Number(totals[0]?.total ?? 0),
      limit: dto.limit,
      offset: dto.offset,
    };
  }

  /** the requested view, else the entity's default; null when it has none */
  /**
   * Display labels for coded columns — aum_band renders as "$1B – $5B" rather
   * than the raw 1b_5b. Only closed vocabularies are sent: firm_name has 32,009
   * options and full_name 455,296, which are lookups, not labels.
   */
  private async readCodeVocabularies(
    attributes: { referenceColumn: string | null }[],
  ): Promise<Map<string, { value: string; label: string }[]>> {
    const keys = [
      ...new Set(
        attributes
          .map((a) => a.referenceColumn)
          .filter((key): key is string => key !== null),
      ),
    ];

    if (keys.length === 0) {
      return new Map();
    }

    const counts = await this.appPrismaService.facetOption.groupBy({
      by: ['allowKey'],
      where: { allowKey: { in: keys } },
      _count: { _all: true },
    });

    const closed = counts
      .filter((c) => c._count._all <= CODE_VOCABULARY_MAX)
      .map((c) => c.allowKey);

    if (closed.length === 0) {
      return new Map();
    }

    const options = await this.appPrismaService.facetOption.findMany({
      where: { allowKey: { in: closed } },
      select: { allowKey: true, value: true, label: true },
      // same order the facet rail uses, so a picker built from these agrees
      orderBy: [{ allowKey: 'asc' }, { position: 'asc' }, { label: 'asc' }],
    });

    const byKey = new Map<string, { value: string; label: string }[]>();

    for (const { allowKey, value, label } of options) {
      byKey.set(allowKey, [...(byKey.get(allowKey) ?? []), { value, label }]);
    }

    return byKey;
  }

  private async loadView(
    dto: GetEntityRecordsDto,
    entityId: string,
    workspaceId: string,
    attributes: {
      id: string;
      label: string;
      icon: string | null;
      type: string;
      referenceColumn: string | null;
      group: string | null;
      isEditable: boolean;
      choices: { id: string; name: string; color: string | null }[];
    }[],
    optionsByKey: Map<string, { value: string; label: string }[]>,
  ) {
    const view = await this.appPrismaService.entityView.findFirst({
      where: dto.viewId
        ? { id: dto.viewId, entityId, workspaceId }
        : { entityId, workspaceId, isDefault: true },
      select: {
        id: true,
        name: true,
        isDefault: true,
        filterTree: true,
        sort: true,
        fields: {
          select: {
            id: true,
            position: true,
            isVisible: true,
            isPinned: true,
            width: true,
            lazy: true,
            paths: {
              select: { attributeId: true },
              orderBy: { position: 'asc' },
              take: 1,
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!view) {
      if (dto.viewId) {
        throw new NotFoundException('View not found');
      }

      return null;
    }

    const attributeById = new Map(attributes.map((a) => [a.id, a]));

    const fields = view.fields.flatMap((field) => {
      const attributeId = field.paths[0]?.attributeId;
      const attribute = attributeId
        ? attributeById.get(attributeId)
        : undefined;

      // an archived attribute leaves its field row orphaned; drop it silently
      if (!attributeId || !attribute) {
        return [];
      }

      return [
        {
          fieldId: field.id,
          attributeId,
          label: attribute.label,
          icon: attribute.icon,
          type: attribute.type,
          referenceColumn: attribute.referenceColumn,
          options: attribute.referenceColumn
            ? (optionsByKey.get(attribute.referenceColumn) ?? [])
            : [],
          group: attribute.group,
          position: field.position,
          isVisible: field.isVisible,
          isPinned: field.isPinned,
          width: field.width,
          lazy: field.lazy,
          isEditable: attribute.isEditable,
          choices: attribute.choices,
        },
      ];
    });

    return {
      filterTree: view.filterTree,
      sort: view.sort,
      summary: {
        id: view.id,
        name: view.name,
        isDefault: view.isDefault,
        sort: (view.sort as SortAst | null) ?? [],
        fields,
      },
    };
  }

  /** adapts prisma's raw interface to the hydrator's narrow executor */
  private get executor() {
    return {
      query: async <T>(
        sql: string,
        params: unknown[],
      ): Promise<{ rows: T[] }> => ({
        rows: await this.appPrismaService.$queryRawUnsafe<T[]>(sql, ...params),
      }),
    };
  }
}
