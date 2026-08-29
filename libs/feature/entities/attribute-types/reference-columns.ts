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

const firm = (
  column: string,
  type: AttributeType,
  isArray = false,
): [string, ReferenceColumn] => [
  `firm.${column}`,
  { source: 'firm_search', column, type, isArray },
];

export const REFERENCE_COLUMNS: ReadonlyMap<string, ReferenceColumn> = new Map([
  // identity — the CRD is the stable key of the whole domain, so a recruiter
  // must be able to see, sort and paste it
  advisor('advisor_crd', 'number'),
  advisor('full_name', 'text'),
  advisor('first_name', 'text'),
  advisor('last_name', 'text'),
  advisor('is_active', 'boolean'),
  advisor('current_firm_crd', 'number'),
  advisor('current_firm_name', 'text'),
  advisor('current_firm_since', 'date'),
  advisor('current_firm_count', 'number'),
  advisor('tenure_months', 'number'),
  advisor('experience_months', 'number'),
  advisor('previous_firm_count', 'number'),
  advisor('avg_previous_tenure_months', 'number'),
  advisor('previous_firm_crds', 'number', true),

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
  advisor('is_us_workplace', 'boolean'),

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
  advisor('firm_linkedin_url', 'url'),
  advisor('firm_office_count', 'number'),
  advisor('firm_aum_per_client', 'currency'),
  advisor('firm_aum_cagr_3y', 'percentage'),
  advisor('firm_is_sec_registered', 'boolean'),
  advisor('firm_is_era', 'boolean'),
  advisor('firm_client_type_codes', 'text', true),
  advisor('firm_service_codes', 'text', true),
  advisor('firm_custodian_ids', 'number', true),
  advisor('firm_fund_type_codes', 'text', true),

  // firm projection
  firm('firm_crd', 'number'),
  firm('firm_name', 'text'),
  firm('sec_number', 'text'),
  firm('domain', 'text'),
  firm('linkedin_url', 'url'),
  firm('social_platforms', 'text', true),
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
  firm('primary_registration_type', 'text'),
  firm('discretionary_aum', 'currency'),
  firm('non_discretionary_aum', 'currency'),
  firm('advisory_employee_count', 'number'),
  firm('office_count', 'number'),
  firm('aum_per_employee', 'currency'),
  firm('aum_percentile', 'number'),
  firm('aum_per_advisor_percentile', 'number'),
  firm('aum_cagr_1y', 'percentage'),
  firm('aum_cagr_3y', 'percentage'),
  firm('aum_cagr_5y', 'percentage'),
  firm('employee_cagr_3y', 'percentage'),
  firm('asset_category_codes', 'text', true),
  firm('top_custodian_id', 'number'),
  firm('top_custodian_aum', 'currency'),
  firm('fund_count', 'number'),
  firm('total_fund_gav', 'currency'),
  firm('affiliated_crds', 'number', true),
  firm('owner_count', 'number'),
  firm('owner_advisor_count', 'number'),
  firm('ownership_concentration', 'percentage'),
  firm('first_filing_date', 'date'),
  firm('latest_filing_date', 'date'),
  firm('filing_count', 'number'),
  firm('client_type_codes', 'text', true),
  firm('service_codes', 'text', true),
  firm('custodian_ids', 'number', true),
  firm('fund_type_codes', 'text', true),
  firm('advisors_gained_90d', 'number'),
  firm('advisors_lost_90d', 'number'),
  firm('net_advisor_flow_90d', 'number'),
]);

/** null when the key is unknown — the compiler then drops the condition */
export const resolveReferenceColumn = (
  key: string | null,
): ReferenceColumn | null =>
  key ? (REFERENCE_COLUMNS.get(key) ?? null) : null;
