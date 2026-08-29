import type { SourceKind } from '@orm/app';

import { resolveReferenceColumn } from '@feature/entities/attribute-types/reference-columns.js';
import type { FilterTree, SortAst } from '@feature/entities/filter-sort/ast.js';
import { compileFilterTree } from '@feature/entities/filter-sort/filter-compiler.js';
import { compileSort } from '@feature/entities/filter-sort/sort-compiler.js';
import type { AttributeMeta } from '@feature/entities/relationship-edges.js';

/**
 * The grid's join, inverted. There the tenant record is the base table and the
 * projection is joined for its columns; here the projection is the base table
 * and the tenant record is optional, because prospecting reads 510k advisors of
 * whom almost none have been saved.
 */
const PROJECTION: Record<SourceKind, { table: string; key: string }> = {
  advisor: { table: 'market.advisor_search', key: 'advisor_crd' },
  firm: { table: 'market.firm_search', key: 'firm_crd' },
};

export const PROSPECT_ALIAS = 'ref';
export const RECORD_ALIAS = 'er';
export const REFERENCE_PREFIX = 'ref_';

export type ProspectQueryInput = {
  workspaceId: string;
  entityId: string;
  sourceKind: SourceKind;
  attributesById: Map<string, AttributeMeta>;
  filter: FilterTree | null;
  sort: SortAst;
  limit: number;
  offset: number;
  /** reference attributes to return; the rail decides which columns show */
  selectAttributeIds: string[];
};

export type BuiltQuery = { sql: string; params: unknown[] };

/**
 * Values only ever reach SQL through addParam. Identifiers come from the
 * allowlist and the projection map above, never from a request.
 */
export const buildProspectSearchQuery = (
  input: ProspectQueryInput,
): BuiltQuery => {
  const params: unknown[] = [];
  const addParam = (value: unknown): string => {
    params.push(value);

    return `$${params.length}`;
  };

  const workspaceParam = addParam(input.workspaceId);
  const entityParam = addParam(input.entityId);
  const projection = PROJECTION[input.sourceKind];
  const sourceKindParam = addParam(input.sourceKind);

  const compileCtx = {
    attributesById: input.attributesById,
    recordAlias: RECORD_ALIAS,
    workspaceParam,
    referenceAlias: PROSPECT_ALIAS,
    addParam,
  };

  const where = input.filter
    ? compileFilterTree(input.filter, compileCtx)
    : null;
  const sort = compileSort(input.sort, compileCtx);

  const selects = input.selectAttributeIds.flatMap((attributeId) => {
    const ref = input.attributesById.get(attributeId)?.referenceColumn;
    const resolved = ref ? resolveReferenceColumn(ref) : null;

    return resolved && resolved.source === `${input.sourceKind}_search`
      ? [
          `${PROSPECT_ALIAS}.${resolved.column} AS "${REFERENCE_PREFIX}${attributeId}"`,
        ]
      : [];
  });

  /** CRD is the projection's primary key, so it breaks ties deterministically */
  const orderBy = [
    ...sort.orderParts,
    `${PROSPECT_ALIAS}.${projection.key} ASC`,
  ].join(', ');

  /**
   * The saved-record join is the payoff of one database: every row knows
   * whether it is already in this workspace's CRM without a second round trip.
   * It is scoped inside the ON clause rather than the WHERE so it stays a left
   * join and never filters the market rows away.
   */
  const sql = `
SELECT ${PROSPECT_ALIAS}.${projection.key} AS source_crd,
       ${RECORD_ALIAS}.id AS record_id${selects.length > 0 ? `,\n       ${selects.join(',\n       ')}` : ''},
       count(*) OVER () AS total_count
  FROM ${projection.table} ${PROSPECT_ALIAS}
  LEFT JOIN app.entity_record ${RECORD_ALIAS}
    ON ${RECORD_ALIAS}.source_crd = ${PROSPECT_ALIAS}.${projection.key}
   AND ${RECORD_ALIAS}.source_kind = ${sourceKindParam}::"app"."source_kind"
   AND ${RECORD_ALIAS}.workspace_id = ${workspaceParam}
   AND ${RECORD_ALIAS}.entity_id = ${entityParam}${sort.joins.length > 0 ? `\n  ${sort.joins.join('\n  ')}` : ''}
${where ? ` WHERE ${where}` : ''}
 ORDER BY ${orderBy}
 LIMIT ${addParam(input.limit)} OFFSET ${addParam(input.offset)}`;

  return { sql, params };
};
