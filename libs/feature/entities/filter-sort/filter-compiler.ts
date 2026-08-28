import { attributeTypeRegistry } from '../attribute-types/registry.js';
import { resolveReferenceColumn } from '../attribute-types/reference-columns.js';
import { relDispatch, type AttributeMeta } from '../relationship-edges.js';
import type { FilterCondition, FilterTree } from './ast.js';
import { operatorRegistry } from './operator-registry.js';

export type CompileContext = {
  attributesById: Map<string, AttributeMeta>;
  /** sql identifier for the page-level record table, typically "er" */
  recordAlias: string;
  /** pre-registered workspace placeholder, reused by every emitted predicate */
  workspaceParam: string;
  /** alias of the joined market projection; null when the entity has none */
  referenceAlias: string | null;
  addParam: (value: unknown) => string;
};

/**
 * Returns null when the tree contributes no constraint. Fail-soft: a condition
 * referencing a deleted attribute is dropped and an empty and/or branch
 * collapses upward, so a saved view survives a schema change.
 */
export const compileFilterTree = (tree: FilterTree, ctx: CompileContext): string | null => {
  switch (tree.kind) {
    case 'and':
    case 'or': {
      const parts = tree.children
        .map((child) => compileFilterTree(child, ctx))
        .filter((part): part is string => part !== null);

      if (parts.length === 0) {
        return null;
      }

      if (parts.length === 1) {
        return parts[0] as string;
      }

      return `(${parts.join(tree.kind === 'and' ? ' AND ' : ' OR ')})`;
    }

    case 'not': {
      const inner = compileFilterTree(tree.child, ctx);

      return inner ? `NOT (${inner})` : null;
    }

    case 'condition':
      return compileCondition(tree, ctx);
  }
};

const compileCondition = (cond: FilterCondition, ctx: CompileContext): string | null => {
  const attrs = cond.path.map((step) => ctx.attributesById.get(step.attributeId));

  if (attrs.some((attr) => !attr)) {
    return null;
  }

  const resolved = attrs as AttributeMeta[];
  const terminal = resolved.at(-1) as AttributeMeta;

  // a reference resolves to a market column and cannot be traversed through
  if (terminal.referenceColumn !== null) {
    return resolved.length === 1 ? compileReference(cond, terminal, ctx) : null;
  }

  if (terminal.relationshipType !== null) {
    return null;
  }

  for (const hop of resolved.slice(0, -1)) {
    if (hop.relationshipType === null) {
      return null;
    }
  }

  const opDesc = operatorRegistry.resolve(terminal.type, cond.operator);

  if (!opDesc) {
    return null;
  }

  const column = attributeTypeRegistry.effectiveStorageColumn(terminal.type, terminal.isMultiValue);

  if (column === 'none') {
    return null;
  }

  const isEmpty = cond.operator === 'isEmpty';
  const presenceOp = isEmpty || cond.operator === 'isNotEmpty';
  const valueAlias = 'v_t';
  const termAttrParam = ctx.addParam(terminal.id);
  const hops = resolved.slice(0, -1);

  const tailPredicate = presenceOp
    ? `${valueAlias}.${column} IS NOT NULL`
    : opDesc.emit({
        columnExpr: `${valueAlias}.${column}`,
        value: cond.value,
        addParam: ctx.addParam,
      });

  if (hops.length === 0) {
    const body = `SELECT 1 FROM app.entity_record_value ${valueAlias}
      WHERE ${valueAlias}.record_id = ${ctx.recordAlias}.id
        AND ${valueAlias}.attribute_id = ${termAttrParam}
        AND ${valueAlias}.workspace_id = ${ctx.workspaceParam}
        AND ${tailPredicate}`;

    return isEmpty ? `NOT EXISTS (${body})` : `EXISTS (${body})`;
  }

  // multi-hop: the first hop sits in FROM with its predicates in the outer
  // WHERE; later hops join on the previous hop's target
  const firstDispatch = relDispatch(hops[0] as AttributeMeta);

  if (!firstDispatch.attrId) {
    return null;
  }

  const firstAttrParam = ctx.addParam(firstDispatch.attrId);
  const joins: string[] = [];
  let prevExpr = `h1.${firstDispatch.targetCol}`;

  for (let i = 1; i < hops.length; i++) {
    const dispatch = relDispatch(hops[i] as AttributeMeta);

    if (!dispatch.attrId) {
      return null;
    }

    const alias = `h${i + 1}`;

    joins.push(
      `JOIN app.entity_record_relationship ${alias}
         ON ${alias}.${dispatch.sourceCol} = ${prevExpr}
        AND ${alias}.attribute_id = ${ctx.addParam(dispatch.attrId)}
        AND ${alias}.workspace_id = ${ctx.workspaceParam}`,
    );
    prevExpr = `${alias}.${dispatch.targetCol}`;
  }

  const body = `SELECT 1 FROM app.entity_record_relationship h1
        ${joins.join('\n        ')}
        JOIN app.entity_record_value ${valueAlias}
          ON ${valueAlias}.record_id = ${prevExpr}
         AND ${valueAlias}.attribute_id = ${termAttrParam}
         AND ${valueAlias}.workspace_id = ${ctx.workspaceParam}
        WHERE h1.${firstDispatch.sourceCol} = ${ctx.recordAlias}.id
          AND h1.attribute_id = ${firstAttrParam}
          AND h1.workspace_id = ${ctx.workspaceParam}
          AND ${tailPredicate}`;

  return isEmpty ? `NOT EXISTS (${body})` : `EXISTS (${body})`;
};

/**
 * Reference attributes resolve to a column on the joined market projection —
 * no EXISTS, no cell lookup, because the value was never copied into a cell.
 * The identifier comes from the allowlist, never from the stored attribute.
 */
const compileReference = (
  cond: FilterCondition,
  attr: AttributeMeta,
  ctx: CompileContext,
): string | null => {
  if (!ctx.referenceAlias) {
    return null;
  }

  const ref = resolveReferenceColumn(attr.referenceColumn);

  if (!ref) {
    return null;
  }

  const columnExpr = `${ctx.referenceAlias}.${ref.column}`;

  if (cond.operator === 'isEmpty') {
    return ref.isArray
      ? `(${columnExpr} IS NULL OR cardinality(${columnExpr}) = 0)`
      : `${columnExpr} IS NULL`;
  }

  if (cond.operator === 'isNotEmpty') {
    return ref.isArray
      ? `(${columnExpr} IS NOT NULL AND cardinality(${columnExpr}) > 0)`
      : `${columnExpr} IS NOT NULL`;
  }

  // array columns use containment/overlap rather than scalar comparison
  if (ref.isArray) {
    const values = Array.isArray(cond.value) ? cond.value : [cond.value];

    switch (cond.operator) {
      case 'is':
      case 'isAnyOf':
        return `${columnExpr} && ${ctx.addParam(values)}`;
      case 'isNot':
      case 'isNoneOf':
        return `NOT (${columnExpr} && ${ctx.addParam(values)})`;
      default:
        return null;
    }
  }

  const opDesc = operatorRegistry.resolve(ref.type, cond.operator);

  if (!opDesc) {
    return null;
  }

  return opDesc.emit({ columnExpr, value: cond.value, addParam: ctx.addParam });
};
