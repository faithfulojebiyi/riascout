import type { SearchAdvisorsSchema0 } from '../../../api/generated/rIAScoutAPI.schemas';
import type {
  FacetSelection,
  FacetValue,
  FilterOperator,
} from '../types/prospecting';

type FilterTree = SearchAdvisorsSchema0;
type Condition = Extract<FilterTree, { kind: 'condition' }>;

const condition = (
  attributeId: string,
  operator: FilterOperator,
  value: unknown,
): Condition => ({
  kind: 'condition',
  path: [{ attributeId }],
  operator,
  value,
});

const conditionFor = (
  attributeId: string,
  facet: FacetValue,
): Condition | null => {
  switch (facet.kind) {
    case 'multiSelect':
      // an empty selection is no filter, not a filter matching nothing
      return facet.values.length > 0
        ? condition(attributeId, facet.operator, facet.values)
        : null;

    case 'boolean':
      return condition(attributeId, 'is', facet.value);

    case 'number': {
      const usable = Array.isArray(facet.value)
        ? facet.value.every((v) => Number.isFinite(v))
        : Number.isFinite(facet.value);

      return usable
        ? condition(attributeId, facet.operator, facet.value)
        : null;
    }

    case 'date':
      return facet.value === '' || facet.value === null
        ? null
        : condition(attributeId, facet.operator, facet.value);
  }
};

/**
 * Facets compose with AND, the same tree the entity grid sends. Null rather
 * than an empty and-node when nothing is selected: the compiler treats an empty
 * tree as no constraint, but null states that at the boundary instead of
 * relying on it.
 */
export const buildFilterTree = (
  selection: FacetSelection,
): FilterTree | null => {
  const children = Object.entries(selection).flatMap(([attributeId, facet]) => {
    const built = conditionFor(attributeId, facet);

    return built ? [built] : [];
  });

  if (children.length === 0) return null;

  return children.length === 1
    ? (children[0] as FilterTree)
    : { kind: 'and', children };
};
