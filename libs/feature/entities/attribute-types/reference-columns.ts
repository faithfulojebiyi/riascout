import type { AttributeType } from '@orm/app';

/**
 * The allowlist of market projection columns a reference attribute may resolve
 * to. Identifiers are NEVER taken from user input — a reference attribute's
 * referenceColumn is validated against this map before it reaches SQL.
 */
export type ReferenceSource = 'advisor_search' | 'firm_search';

export type ReferenceColumn = {
  source: ReferenceSource;
  column: string;
  type: AttributeType;
  /** array columns filter with ANY/&& rather than scalar operators */
  isArray?: boolean;
};

const advisor = (
  column: string,
  type: AttributeType,
  isArray = false,
): [string, ReferenceColumn] => [
  `advisor.${column}`,
  { source: 'advisor_search', column, type, isArray },
];

const firm = (column: string, type: AttributeType, isArray = false): [string, ReferenceColumn] => [
  `firm.${column}`,
  { source: 'firm_search', column, type, isArray },
];

export const REFERENCE_COLUMNS: ReadonlyMap<string, ReferenceColumn> = new Map([
  // identity and career
  advisor('full_name', 'text'),
  advisor('is_active', 'boolean'),
  advisor('current_firm_crd', 'number'),
  advisor('current_firm_name', 'text'),
  advisor('current_firm_since', 'date'),
  advisor('current_firm_count', 'number'),
  advisor('tenure_months', 'number'),
  advisor('experience_months', 'number'),
  advisor('previous_firm_count', 'number'),
  advisor('avg_previous_tenure_months', 'number'),

  // credentials
  advisor('exam_codes', 'text', true),
  advisor('designations', 'text', true),
  advisor('jurisdictions', 'text', true),
  advisor('jurisdiction_count', 'number'),

  // disclosures — three-valued; `unknown` should be ~0 after the upstream fix
  advisor('disclosure_status', 'text'),
  advisor('disclosure_count', 'number'),

  // ownership
  advisor('owns_current_firm', 'boolean'),
  advisor('ownership_band', 'text'),
  advisor('is_control_person', 'boolean'),
  advisor('owner_title', 'text'),

  // location
  advisor('city', 'text'),
  advisor('state', 'text'),
  advisor('postal_code', 'text'),
  advisor('country_code', 'text'),

  // movement
  advisor('last_moved_on', 'date'),
  advisor('last_detected_on', 'date'),
  advisor('previous_firm_crd', 'number'),
  advisor('move_count_5y', 'number'),

  // denormalized firm
  advisor('firm_aum', 'currency'),
  advisor('firm_aum_band', 'text'),
  advisor('firm_client_count', 'number'),
  advisor('firm_employee_count', 'number'),
  advisor('firm_advisor_count', 'number'),
  advisor('firm_aum_per_advisor', 'currency'),
  advisor('firm_channel', 'text'),
  advisor('firm_state', 'text'),
  advisor('firm_domain', 'text'),

  // firm projection
  firm('firm_name', 'text'),
  firm('domain', 'text'),
  firm('city', 'text'),
  firm('state', 'text'),
  firm('channel_code', 'text'),
  firm('is_sec_registered', 'boolean'),
  firm('is_era', 'boolean'),
  firm('regulatory_aum', 'currency'),
  firm('aum_band', 'text'),
  firm('client_count', 'number'),
  firm('employee_count', 'number'),
  firm('advisor_count', 'number'),
  firm('aum_per_advisor', 'currency'),
  firm('aum_per_client', 'currency'),
  firm('aum_cagr_3y', 'percentage'),
  firm('client_type_codes', 'text', true),
  firm('service_codes', 'text', true),
  firm('custodian_ids', 'number', true),
  firm('fund_type_codes', 'text', true),
  firm('advisors_gained_90d', 'number'),
  firm('advisors_lost_90d', 'number'),
  firm('net_advisor_flow_90d', 'number'),
]);

/** null when the key is unknown — the compiler then drops the condition */
export const resolveReferenceColumn = (key: string | null): ReferenceColumn | null =>
  key ? (REFERENCE_COLUMNS.get(key) ?? null) : null;
