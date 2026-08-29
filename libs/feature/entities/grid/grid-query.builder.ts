import type { SourceKind } from '@orm/app';

import { resolveReferenceColumn } from '../attribute-types/reference-columns.js';
import type { FilterTree, SortAst } from '../filter-sort/ast.js';
import { compileFilterTree } from '../filter-sort/filter-compiler.js';
import { compileSort } from '../filter-sort/sort-compiler.js';
import type { AttributeMeta } from '../relationship-edges.js';

/**
 * Reference attributes are projected, never copied into cells, so the grid
 * joins the market projection for the page's records. Which projection is
 * decided here from the entity's source kind — never from user input.
 */
const PROJECTION: Record<SourceKind, { table: string; key: string }> = {
  advisor: { table: 'market.advisor_search', key: 'advisor_crd' },
  firm: { table: 'market.firm_search', key: 'firm_crd' },
};

export const REFERENCE_ALIAS = 'ref';
export const RECORD_ALIAS = 'er';

export type GridQueryInput = {
  workspaceId: string;
  entityId: string;
  sourceKind: SourceKind | null;
  attributesById: Map<string, AttributeMeta>;
  filter: FilterTree | null;
  sort: SortAst;
  limit: number;
  offset: number;
  /** reference attributes to project; omit for none */
  referenceAttributeIds?: string[];
};

/** value of a projected market column, keyed by the attribute that names it */
export const REFERENCE_PREFIX = 'ref_';

export type BuiltQuery = { sql: string; params: unknown[] };

/**
 * Values only ever reach SQL through addParam. Identifiers come from the
 * attribute registry and the projection map above, never from a request.
 */
export const buildGridPageQuery = (input: GridQueryInput): BuiltQuery => {
  const params: unknown[] = [];
  const addParam = (value: unknown): string => {
    params.push(value);

    return `$${params.length}`;
  };

  const workspaceParam = addParam(input.workspaceId);
  const entityParam = addParam(input.entityId);

  const projection = input.sourceKind ? PROJECTION[input.sourceKind] : null;
  const referenceAlias = projection ? REFERENCE_ALIAS : null;

  const where = [
    `${RECORD_ALIAS}.workspace_id = ${workspaceParam}`,
    `${RECORD_ALIAS}.entity_id = ${entityParam}`,
  ];

  const predicate = input.filter
    ? compileFilterTree(input.filter, {
        attributesById: input.attributesById,
        recordAlias: RECORD_ALIAS,
        workspaceParam,
        referenceAlias,
        addParam,
      })
    : null;

  if (predicate) {
    where.push(predicate);
  }

  const sort = compileSort(input.sort, {
    attributesById: input.attributesById,
    recordAlias: RECORD_ALIAS,
    workspaceParam,
    referenceAlias,
    addParam,
  });

  const joins: string[] = [];

  if (projection) {
    joins.push(
      `LEFT JOIN ${projection.table} ${REFERENCE_ALIAS}
         ON ${REFERENCE_ALIAS}.${projection.key} = ${RECORD_ALIAS}.source_crd`,
    );
  }

  joins.push(...sort.joins);

  // id tiebreak keeps paging stable when the sort column has duplicates
  const orderBy = [...sort.orderParts, `${RECORD_ALIAS}.id ASC`].join(', ');

  /**
   * Reference attributes have no cell to hydrate — their value lives on the
   * projection. Selecting them here is what makes them render at all; the join
   * alone only enables filtering and sorting.
   */
  const referenceSelects = (input.referenceAttributeIds ?? []).flatMap(
    (attributeId) => {
      const attribute = input.attributesById.get(attributeId);
      const ref = attribute?.referenceColumn
        ? resolveReferenceColumn(attribute.referenceColumn)
        : null;

      return ref && referenceAlias
        ? [
            `${referenceAlias}.${ref.column} AS "${REFERENCE_PREFIX}${attributeId}"`,
          ]
        : [];
    },
  );

  const sql = `SELECT ${RECORD_ALIAS}.id,
       ${RECORD_ALIAS}.source_crd,
       ${sort.sortValueExpr} AS sort_value${referenceSelects.length ? ',\n       ' + referenceSelects.join(',\n       ') : ''}
  FROM app.entity_record ${RECORD_ALIAS}
  ${joins.join('\n  ')}
 WHERE ${where.join('\n   AND ')}
 ORDER BY ${orderBy}
 LIMIT ${addParam(input.limit)} OFFSET ${addParam(input.offset)}`;

  return { sql, params };
};

/** total matching rows for the same filter, without sort joins or paging */
export const buildGridCountQuery = (
  input: Omit<GridQueryInput, 'sort' | 'limit' | 'offset'>,
): BuiltQuery => {
  const params: unknown[] = [];
  const addParam = (value: unknown): string => {
    params.push(value);

    return `$${params.length}`;
  };

  const workspaceParam = addParam(input.workspaceId);
  const entityParam = addParam(input.entityId);

  const projection = input.sourceKind ? PROJECTION[input.sourceKind] : null;

  const where = [
    `${RECORD_ALIAS}.workspace_id = ${workspaceParam}`,
    `${RECORD_ALIAS}.entity_id = ${entityParam}`,
  ];

  const predicate = input.filter
    ? compileFilterTree(input.filter, {
        attributesById: input.attributesById,
        recordAlias: RECORD_ALIAS,
        workspaceParam,
        referenceAlias: projection ? REFERENCE_ALIAS : null,
        addParam,
      })
    : null;

  if (predicate) {
    where.push(predicate);
  }

  const join = projection
    ? `\n  LEFT JOIN ${projection.table} ${REFERENCE_ALIAS}
         ON ${REFERENCE_ALIAS}.${projection.key} = ${RECORD_ALIAS}.source_crd`
    : '';

  return {
    sql: `SELECT count(*)::bigint AS total
  FROM app.entity_record ${RECORD_ALIAS}${join}
 WHERE ${where.join('\n   AND ')}`,
    params,
  };
};
