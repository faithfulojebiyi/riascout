import type { FilterOperator } from '@feature/entities/filter-sort/ast.js';
import type { ReferenceColumn } from '@feature/entities/attribute-types/reference-columns.js';

export type FacetKind =
  'multiSelect' | 'search' | 'number' | 'boolean' | 'date';

/** dim tables supply options for these; the rest need a distinct query */
export const DIM_SOURCE: Readonly<Record<string, string>> = {
  'advisor.firm_aum_band': 'dim_aum_band',
  'firm.aum_band': 'dim_aum_band',
  'advisor.firm_channel': 'dim_firm_channel',
  'firm.channel_code': 'dim_firm_channel',
  'firm.client_type_codes': 'dim_client_type',
  'firm.service_codes': 'dim_service_type',
  'firm.fee_method_codes': 'dim_fee_method',
  'firm.fund_type_codes': 'dim_fund_type',
  'firm.asset_category_codes': 'dim_asset_category',
};

const OPERATORS: Record<FacetKind, FilterOperator[]> = {
  multiSelect: ['isAnyOf', 'isNoneOf', 'isEmpty', 'isNotEmpty'],
  search: ['isAnyOf', 'isNoneOf'],
  number: ['isGreaterThan', 'isLessThan', 'isBetween', 'isEmpty', 'isNotEmpty'],
  boolean: ['is'],
  date: ['isWithinLastNDays', 'isAfter', 'isBefore', 'isBetween'],
};

/**
 * Null means the column gets no facet. A url is never filtered by value, only
 * by presence, which belongs on a presence toggle rather than a text box.
 */
export const facetKindFor = (ref: ReferenceColumn): FacetKind | null => {
  switch (ref.type) {
    /**
     * A numeric array holds identifiers — previous firm CRDs, custodian ids —
     * not a vocabulary, so it is looked up rather than enumerated. Listing
     * 61,000 CRDs as checkboxes is not a facet.
     */
    case 'number':
      return ref.isArray ? 'search' : 'number';
    case 'currency':
    case 'percentage':
      return 'number';
    case 'boolean':
    case 'checkbox':
      return 'boolean';
    case 'date':
    case 'timestamp':
      return 'date';
    case 'text':
      // provisional: attachOptions demotes it to search if it hits the cap
      return 'multiSelect';
    case 'url':
    case 'email':
    case 'phone':
    case 'domain':
      return null;
    default:
      return null;
  }
};

export const operatorsFor = (kind: FacetKind): FilterOperator[] =>
  OPERATORS[kind];
