import type { FilterTree } from '@feature/entities/filter-sort/ast.js';

const collect = (tree: FilterTree, into: Set<string>): void => {
  switch (tree.kind) {
    case 'condition':
      for (const step of tree.path) into.add(step.attributeId);
      break;
    case 'and':
    case 'or':
      for (const child of tree.children) collect(child, into);
      break;
    case 'not':
      collect(tree.child, into);
      break;
  }
};

/**
 * The compiler drops conditions it cannot resolve so a saved view survives a
 * schema change. That is wrong for an ad-hoc search: a dropped condition widens
 * the result set silently, and 510k rows reads as an answer rather than as a
 * failed filter. Returns the offending ids so the caller can 400.
 */
export const unresolvableAttributeIds = (
  tree: FilterTree | null,
  known: ReadonlySet<string>,
): string[] => {
  if (!tree) return [];

  const referenced = new Set<string>();
  collect(tree, referenced);

  return [...referenced].filter((id) => !known.has(id));
};
