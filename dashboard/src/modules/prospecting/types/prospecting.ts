import type {
  FacetDefinition,
  FacetOption,
  ProspectRow,
  SearchAdvisors,
  SearchAdvisorsSchema0,
} from '../../../api/generated/rIAScoutAPI.schemas';

export type { FacetDefinition, FacetOption, ProspectRow, SearchAdvisors };

/** the operator vocabulary, taken from the generated tree so a facet cannot
 *  emit one the compiler does not implement */
export type FilterOperator = Extract<
  SearchAdvisorsSchema0,
  { kind: 'condition' }
>['operator'];

/**
 * One facet's current selection. Absent from the map means the facet is not
 * applied — never encode "no filter" as an empty value, which would compile to
 * a condition matching nothing.
 */
export type FacetValue =
  | { kind: 'multiSelect'; operator: FilterOperator; values: string[] }
  | { kind: 'boolean'; value: boolean }
  | {
      kind: 'number';
      operator: FilterOperator;
      value: number | [number, number];
    }
  | { kind: 'date'; operator: FilterOperator; value: string | number };

export type FacetSelection = Record<string, FacetValue>;
