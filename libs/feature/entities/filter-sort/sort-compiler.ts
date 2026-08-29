import type { AttributeRelationshipType } from '@orm/app';

import { attributeTypeRegistry } from '../attribute-types/registry.js';
import { resolveReferenceColumn } from '../attribute-types/reference-columns.js';
import { relDispatch, type AttributeMeta } from '../relationship-edges.js';
import type { SortAst } from './ast.js';

export type SortCompileContext = {
  attributesById: Map<string, AttributeMeta>;
  recordAlias: string;
  workspaceParam: string;
  /** alias of the joined market projection; null when the entity has none */
  referenceAlias: string | null;
  addParam: (value: unknown) => string;
};

export type CompiledSort = {
  /** LEFT JOINs the caller appends to the page CTE's FROM */
  joins: string[];
  orderParts: string[];
  /** keyset cursor is only stable on a single-column sort; null otherwise */
  primarySortExpr: string | null;
  primaryDirection: 'asc' | 'desc' | null;
  sortValueExpr: string;
};

/**
 * A 1:M or M:M hop would multiply rows and make ordering non-deterministic,
 * so only to-one hops may appear before the terminal step.
 */
const SORT_HOP_OK = new Set<AttributeRelationshipType>([
  'oneToOne',
  'manyToOne',
]);

export const compileSort = (
  sort: SortAst,
  ctx: SortCompileContext,
): CompiledSort => {
  const joins: string[] = [];
  const orderParts: string[] = [];

  let primarySortExpr: string | null = null;
  let primaryDirection: 'asc' | 'desc' | null = null;

  sort.forEach((spec, index) => {
    const attrs = spec.path.map((step) =>
      ctx.attributesById.get(step.attributeId),
    );

    if (attrs.some((attr) => !attr)) {
      return;
    }

    const resolved = attrs as AttributeMeta[];
    const terminal = resolved.at(-1) as AttributeMeta;

    const sortExpr =
      terminal.referenceColumn !== null
        ? referenceSortExpr(resolved, terminal, ctx)
        : eavSortExpr(resolved, terminal, ctx, index, joins);

    if (!sortExpr) {
      return;
    }

    // NULLS LAST in both directions: "no value" is never the most relevant row
    orderParts.push(
      `${sortExpr} ${spec.direction === 'desc' ? 'DESC' : 'ASC'} NULLS LAST`,
    );

    if (primarySortExpr === null) {
      primarySortExpr = sortExpr;
      primaryDirection = spec.direction;
    }
  });

  const single = orderParts.length === 1;

  return {
    joins,
    orderParts,
    primarySortExpr: single ? primarySortExpr : null,
    primaryDirection: single ? primaryDirection : null,
    sortValueExpr: primarySortExpr ?? `${ctx.recordAlias}.id::text`,
  };
};

/** a reference is a column on the joined projection — no hops, no cell lookup */
const referenceSortExpr = (
  resolved: AttributeMeta[],
  terminal: AttributeMeta,
  ctx: SortCompileContext,
): string | null => {
  if (resolved.length !== 1 || !ctx.referenceAlias) {
    return null;
  }

  const ref = resolveReferenceColumn(terminal.referenceColumn);

  // ordering by an array column is meaningless — cardinality is the useful proxy
  if (!ref || ref.isArray) {
    return null;
  }

  return `${ctx.referenceAlias}.${ref.column}`;
};

const eavSortExpr = (
  resolved: AttributeMeta[],
  terminal: AttributeMeta,
  ctx: SortCompileContext,
  index: number,
  joins: string[],
): string | null => {
  if (terminal.relationshipType !== null) {
    return null;
  }

  const hops = resolved.slice(0, -1);

  if (
    hops.some(
      (hop) => !hop.relationshipType || !SORT_HOP_OK.has(hop.relationshipType),
    )
  ) {
    return null;
  }

  const column = attributeTypeRegistry.effectiveStorageColumn(
    terminal.type,
    terminal.isMultiValue,
  );

  if (column === 'none') {
    return null;
  }

  const staged: string[] = [];
  let prevExpr = `${ctx.recordAlias}.id`;

  for (const [hopIndex, hop] of hops.entries()) {
    const dispatch = relDispatch(hop);

    if (!dispatch.attrId) {
      return null;
    }

    const alias = `hs${index}_${hopIndex + 1}`;

    staged.push(
      `LEFT JOIN app.entity_record_relationship ${alias}
         ON ${alias}.${dispatch.sourceCol} = ${prevExpr}
        AND ${alias}.attribute_id = ${ctx.addParam(dispatch.attrId)}
        AND ${alias}.workspace_id = ${ctx.workspaceParam}`,
    );
    prevExpr = `${alias}.${dispatch.targetCol}`;
  }

  const valueAlias = `vs${index}`;

  staged.push(
    `LEFT JOIN app.entity_record_value ${valueAlias}
       ON ${valueAlias}.record_id = ${prevExpr}
      AND ${valueAlias}.attribute_id = ${ctx.addParam(terminal.id)}
      AND ${valueAlias}.workspace_id = ${ctx.workspaceParam}`,
  );

  joins.push(...staged);

  return `${valueAlias}.${column}`;
};
