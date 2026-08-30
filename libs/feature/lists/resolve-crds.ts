import type { SourceKind } from '@orm/app';

import type { FilterTree } from '@feature/entities/filter-sort/ast.js';
import { buildProspectSearchQuery } from '@feature/prospecting/search/prospect-query.builder.js';
import type { AttributeMeta } from '@feature/entities/relationship-edges.js';
import type { AppPrismaService } from '@system/database/database.service.js';

/** the outer bound on one save; a larger set is a different product decision */
export const RESOLVE_MAX = 50000;

export type ResolveDeps = {
  appPrismaService: AppPrismaService;
  entityId: string;
  workspaceId: string;
  sourceKind: SourceKind;
  filter: FilterTree | null;
};

/**
 * Reuses the prospecting query so "save everything matching" selects exactly
 * what the rail showed. A second implementation would drift from it silently.
 */
export const resolveCrdsForFilter = async ({
  appPrismaService,
  entityId,
  workspaceId,
  sourceKind,
  filter,
}: ResolveDeps): Promise<string[]> => {
  const attributes: AttributeMeta[] =
    await appPrismaService.entityAttribute.findMany({
      where: { entityId, workspaceId, isArchived: false },
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

  const { sql, params } = buildProspectSearchQuery({
    workspaceId,
    entityId,
    sourceKind,
    attributesById: new Map(attributes.map((a) => [a.id, a])),
    filter,
    sort: [],
    selectAttributeIds: [],
    limit: RESOLVE_MAX,
    offset: 0,
  });

  const rows = await appPrismaService.$queryRawUnsafe<
    { source_crd: bigint | string }[]
  >(sql, ...params);

  return rows.map((row) => String(row.source_crd));
};
