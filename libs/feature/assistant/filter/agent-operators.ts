import type { FilterOperator } from '@feature/entities/filter-sort/ast.js';
import type { FacetDefinition } from '@feature/prospecting/facets/facet-definitions.js';

/** the only predicates the reference compiler emits for array columns */
const ARRAY_OPS: FilterOperator[] = [
  'isAnyOf',
  'isNoneOf',
  'isEmpty',
  'isNotEmpty',
];

const EXTRA_BY_KIND: Record<FacetDefinition['kind'], FilterOperator[]> = {
  number: ['is', 'isNot'],
  date: ['isEmpty', 'isNotEmpty'],
  multiSelect: ['is', 'isNot', 'contains', 'startsWith'],
  search: ['is', 'isNot', 'contains', 'startsWith'],
  boolean: ['isNot', 'isEmpty', 'isNotEmpty'],
};

/**
 * The model may use more than the rail offers: the rail keeps a short menu
 * per facet, while a sentence can carry any predicate the column type
 * supports. Array columns stay pinned to overlap because nothing else compiles.
 */
export const agentOperatorsFor = (facet: FacetDefinition): FilterOperator[] => {
  if (facet.isArray) {
    return ARRAY_OPS;
  }

  const merged = new Set<FilterOperator>([
    ...facet.operators,
    ...EXTRA_BY_KIND[facet.kind],
  ]);

  return [...merged];
};
