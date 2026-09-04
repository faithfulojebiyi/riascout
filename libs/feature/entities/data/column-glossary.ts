import type { FilterOperator } from '../filter-sort/ast.js';

/**
 * What a projected column means to a recruiter: the one place that feeds the
 * attribute description in the grid, the facet description in prospecting, and
 * the field dictionary the assistant reasons over. Static code, so a change is
 * reviewed in a diff and the assistant's prompt prefix stays byte-stable.
 */
export type ColumnGlossaryEntry = {
  /** one sentence, at most ~120 characters */
  description: string;
  /** words recruiters actually say for this field */
  aliases?: readonly string[];
  unit?: 'usd' | 'years' | 'months' | 'count' | 'fraction' | 'date';
  /** what a null means here, since unknown is never zero or false */
  nulls?: string;
  /** one valid condition, shown back to the model when it gets the field wrong */
  example?: { op: FilterOperator; value?: unknown };
};

const NOT_REPORTED = 'not reported on the filing';
const NO_FILING = 'the firm has never filed an ADV';

export const COLUMN_GLOSSARY: Readonly<Record<string, ColumnGlossaryEntry>> = {
  // size and money
  'advisor.firm_aum': {
    description:
      "Regulatory AUM of the adviser's current firm from Form ADV; the closest field to a firm's book",
    aliases: ['book', 'assets', 'AUM', 'firm size'],
    unit: 'usd',
    nulls: NO_FILING,
    example: { op: 'isGreaterThan', value: 2_000_000_000 },
  },
  'advisor.firm_aum_band': {
    description:
      "The current firm's AUM as a labelled band; use the numeric field for thresholds that do not sit on a band edge",
    aliases: ['AUM band', 'size band'],
    nulls: NO_FILING,
    example: { op: 'isAnyOf', value: ['1b_5b', '5b_20b', 'gte_20b'] },
  },
  'advisor.firm_aum_per_advisor': {
    description:
      "Current firm's regulatory AUM divided by its linked active advisers",
    aliases: ['AUM per adviser', 'book per head'],
    unit: 'usd',
    nulls: 'no linked advisers or no filing',
  },
  'firm.regulatory_aum': {
    description: 'Regulatory assets under management from the latest Form ADV',
    aliases: ['AUM', 'assets', 'book', 'firm size'],
    unit: 'usd',
    nulls: NOT_REPORTED,
    example: { op: 'isGreaterThan', value: 2_000_000_000 },
  },
  'firm.aum_band': {
    description:
      'Regulatory AUM as a labelled band; prefer the numeric field for exact thresholds',
    aliases: ['AUM band', 'size band'],
    nulls: NOT_REPORTED,
  },
  'firm.discretionary_aum': {
    description: 'The part of regulatory AUM managed with discretion',
    unit: 'usd',
    nulls: NOT_REPORTED,
  },
  'firm.aum_per_advisor': {
    description: 'Regulatory AUM divided by linked active advisers',
    aliases: ['AUM per adviser', 'productivity'],
    unit: 'usd',
    nulls: 'no linked advisers',
  },
  'firm.non_discretionary_aum': {
    description: 'The part of regulatory AUM managed without discretion',
    unit: 'usd',
    nulls: NOT_REPORTED,
  },
  'firm.aum_per_account': {
    description:
      'Regulatory AUM divided by the total regulatory accounts on the ADV',
    aliases: ['average account size'],
    unit: 'usd',
    nulls: 'accounts not reported',
  },
  'firm.aum_per_employee': {
    description: 'Regulatory AUM divided by the firm-reported employee count',
    unit: 'usd',
    nulls: 'employees not reported',
  },
  'advisor.firm_aum_per_account': {
    description:
      "Current firm's regulatory AUM divided by its total regulatory accounts",
    aliases: ['average account size'],
    unit: 'usd',
    nulls: 'accounts not reported',
  },
  'firm.aum_cagr_3y': {
    description:
      'Compound annual growth of regulatory AUM over the last three filings, as a fraction (0.12 = 12%)',
    aliases: ['growth', 'AUM growth', 'growing firms'],
    unit: 'fraction',
    nulls: 'fewer than three years of filings',
    example: { op: 'isGreaterThan', value: 0.1 },
  },
  'firm.aum_percentile': {
    description:
      'Where the firm sits among all SEC-registered firms by AUM, 0 to 100',
    aliases: ['top firms', 'largest'],
    unit: 'count',
    nulls: NOT_REPORTED,
    example: { op: 'isGreaterThan', value: 90 },
  },

  // headcount
  'firm.advisor_count': {
    description:
      'Advisers with an open registration linked to the firm in IAPD; our count, not the ADV self-report',
    aliases: [
      'headcount',
      'number of advisers',
      'firm size in people',
      'team size',
    ],
    unit: 'count',
    nulls: 'no adviser links to this firm yet',
    example: { op: 'isBetween', value: [5, 20] },
  },
  'firm.observed_advisor_count': {
    description:
      'Linked advisers plus current observations without an open registration interval',
    unit: 'count',
    nulls: 'nothing observed',
  },
  'firm.advisor_linkage_status': {
    description:
      'linked | self_reported_only | unknown: whether individual records link to the firm; self_reported_only means the firm reports advisers we cannot link',
    nulls: 'unknown',
  },
  'firm.employee_count': {
    description: 'Total employees the firm reported on the ADV',
    aliases: ['staff', 'employees'],
    unit: 'count',
    nulls: NOT_REPORTED,
  },
  'firm.advisory_employee_count': {
    description:
      'Employees performing advisory functions, as the firm reported it',
    unit: 'count',
    nulls: NOT_REPORTED,
  },
  'advisor.firm_advisor_count': {
    description:
      "Linked active advisers at the adviser's current firm; how big the team is",
    aliases: ['team size', 'firm headcount', 'small firm', 'large firm'],
    unit: 'count',
    nulls: 'firm not linked',
    example: { op: 'isLessThan', value: 20 },
  },
  'firm.office_count': {
    description: 'Offices reported on the ADV',
    unit: 'count',
    nulls: NOT_REPORTED,
  },

  // tenure and career
  'advisor.tenure_years': {
    description: 'Years at the current firm, from the registration start date',
    aliases: ['tenure', 'time at firm', 'been at the firm'],
    unit: 'years',
    nulls: 'observation-only link, no authentic start date',
    example: { op: 'isLessThan', value: 3 },
  },
  'advisor.tenure_months': {
    description: 'Months at the current firm; use for precise short windows',
    unit: 'months',
    nulls: 'observation-only link, no authentic start date',
  },
  'advisor.experience_years': {
    description: 'Years since the first registration anywhere',
    aliases: ['experience', 'years in the industry', 'seniority'],
    unit: 'years',
    nulls: 'no dated registration history',
    example: { op: 'isGreaterThan', value: 10 },
  },
  'advisor.current_firm_since': {
    description: 'Date the current firm registration began',
    aliases: ['joined', 'start date', 'since'],
    unit: 'date',
    nulls: 'observation-only link, no authentic start date',
    example: { op: 'isAfter', value: '2026-01-01' },
  },
  'advisor.current_firm_source': {
    description:
      'registration | observation: the evidence behind the current firm link',
  },
  'advisor.previous_firm_count': {
    description: 'Distinct earlier firms in the registration history',
    aliases: ['prior firms', 'job changes'],
    unit: 'count',
    nulls: 'no history',
  },
  'advisor.previous_firm_crds': {
    description:
      'CRDs of earlier firms; match with isAnyOf and firm CRDs from lookup_firm',
    aliases: ['ex-', 'formerly at', 'alumni of', 'came from'],
    example: { op: 'isAnyOf', value: [7691] },
  },
  'advisor.avg_previous_tenure_months': {
    description: 'Average months spent at each earlier firm',
    aliases: ['job hopper', 'stability'],
    unit: 'months',
    nulls: 'no earlier firms',
  },
  'advisor.move_count_5y': {
    description: 'Firm changes in the last five years',
    aliases: ['moves', 'mobility', 'changed firms'],
    unit: 'count',
    nulls: 'movement not yet derived',
  },

  // movement
  'advisor.last_moved_on': {
    description:
      'Date of the most recent firm change (valid time); the field for "moved recently"',
    aliases: [
      'moved',
      'switched firms',
      'changed firms',
      'recent movers',
      'left',
    ],
    unit: 'date',
    nulls: 'no move observed yet, or movement not yet derived for this release',
    example: { op: 'isWithinLastNDays', value: 180 },
  },
  'advisor.last_detected_on': {
    description:
      'When we detected the latest move (know time); currently the data load date, so it does not measure latency',
    unit: 'date',
    nulls: 'no move detected',
  },
  'advisor.previous_firm_crd': {
    description: 'CRD of the firm the adviser most recently left',
    aliases: ['came from', 'left'],
    nulls: 'no move observed',
  },
  'firm.advisors_gained_90d': {
    description:
      'Advisers who joined the firm in the last 90 days; the window is fixed',
    aliases: ['hiring', 'growing headcount', 'gaining advisers'],
    unit: 'count',
    nulls: 'movement not yet derived',
    example: { op: 'isGreaterThan', value: 0 },
  },
  'firm.advisors_lost_90d': {
    description:
      'Advisers who left the firm in the last 90 days; the window is fixed',
    aliases: ['attrition', 'losing advisers', 'departures', 'bleeding'],
    unit: 'count',
    nulls: 'movement not yet derived',
    example: { op: 'isGreaterThan', value: 0 },
  },
  'firm.net_advisor_flow_90d': {
    description:
      'Gained minus lost over the last 90 days; negative means net departures',
    aliases: ['net flow', 'shrinking', 'net attrition'],
    unit: 'count',
    nulls: 'movement not yet derived',
    example: { op: 'isLessThan', value: 0 },
  },

  // credentials and compliance
  'advisor.designations': {
    description:
      'Professional designations as IAPD names; "X and Y" is one condition per designation, use get_field_options for exact spelling',
    aliases: [
      'CFP',
      'CFA',
      'ChFC',
      'CPA',
      'CIMA',
      'credentials',
      'certifications',
    ],
    nulls: 'none reported',
    example: { op: 'isAnyOf', value: ['Certified Financial Planner (CFP)'] },
  },
  'advisor.exam_codes': {
    description:
      'Exams passed as IAPD codes (S7, S65, S66, S63, S24, SIE); "X and Y" is one condition per exam',
    aliases: [
      'Series 7',
      'Series 65',
      'Series 66',
      'Series 63',
      'Series 24',
      'licenses',
      'exams',
    ],
    nulls: 'none reported',
    example: { op: 'isAnyOf', value: ['S65'] },
  },
  'advisor.jurisdictions': {
    description: 'States where the adviser is registered',
    aliases: ['licensed in', 'registered in'],
    nulls: 'none reported',
  },
  'advisor.disclosure_status': {
    description:
      'has_disclosure | none_reported | unknown; "no disclosures" means none_reported, and unknown must be reported separately',
    aliases: ['clean record', 'no disclosures', 'disclosures', 'complaints'],
    example: { op: 'isAnyOf', value: ['none_reported'] },
  },
  'advisor.disclosure_count': {
    description: 'Number of disclosure events on the record',
    unit: 'count',
    nulls: 'unknown, not zero',
  },

  // firm shape
  'advisor.firm_channel': {
    description:
      "Current firm's channel: pure_ria (independent RIA), hybrid (RIA with a broker-dealer), bd_affiliated, insurance_affiliated, bank_affiliated, era. There is no wirehouse code",
    aliases: [
      'independent',
      'RIA only',
      'hybrid',
      'broker-dealer',
      'channel',
      'wirehouse',
    ],
    nulls: NO_FILING,
    example: { op: 'isAnyOf', value: ['pure_ria'] },
  },
  'firm.channel_code': {
    description:
      'pure_ria (independent RIA), hybrid (RIA with a broker-dealer), bd_affiliated, insurance_affiliated, bank_affiliated, era. There is no wirehouse code',
    aliases: [
      'independent',
      'RIA only',
      'hybrid',
      'broker-dealer',
      'channel',
      'wirehouse',
    ],
    nulls: NOT_REPORTED,
    example: { op: 'isNoneOf', value: ['hybrid'] },
  },
  'firm.is_era': {
    description:
      'Exempt reporting adviser rather than a registered investment adviser',
    aliases: ['ERA', 'exempt reporting'],
  },
  'advisor.firm_is_era': {
    description:
      "Whether the adviser's current firm is an exempt reporting adviser",
    aliases: ['ERA'],
  },
  'firm.fee_method_codes': {
    description:
      'How the firm charges, as ADV Item 5.E codes; an empty list is unknown, not free',
    aliases: ['fee-only', 'commission', 'AUM fee', 'hourly', 'fees'],
    nulls: 'unknown',
  },
  'firm.custodian_ids': {
    description:
      'Custodian identifiers from Schedule D; not yet resolvable by custodian name, so questions like "custodied at Schwab" cannot be answered today',
    aliases: ['custodian', 'Schwab', 'Fidelity', 'Pershing', 'custodied at'],
    nulls: NOT_REPORTED,
  },
  'advisor.firm_custodian_ids': {
    description:
      "Custodian identifiers of the adviser's current firm; not yet resolvable by name, so custodian questions cannot be answered today",
    aliases: ['custodian', 'custodied at'],
    nulls: NOT_REPORTED,
  },

  // location
  'advisor.state': {
    description:
      "The adviser's own work location state; the default meaning of a place name",
    aliases: ['in', 'based in', 'located in', 'territory'],
    nulls: 'no work address on file',
    example: { op: 'isAnyOf', value: ['TX'] },
  },
  'advisor.firm_state': {
    description:
      "State of the current firm's main office; use only when the user means the firm's headquarters",
    aliases: ['headquartered in', 'firm based in', 'HQ'],
    nulls: NO_FILING,
  },
  'advisor.is_us_workplace': {
    description: 'Whether the work address is in the United States',
    nulls: 'no work address on file',
  },
  'firm.state': {
    description: "State of the firm's main office from the ADV",
    aliases: ['in', 'based in', 'headquartered in', 'HQ'],
    nulls: NOT_REPORTED,
    example: { op: 'isAnyOf', value: ['TX'] },
  },
};

export const glossaryFor = (allowKey: string): ColumnGlossaryEntry | null =>
  COLUMN_GLOSSARY[allowKey] ?? null;

/** every allow key whose aliases mention the word, lower-cased substring match */
export const glossaryKeysForAlias = (word: string): string[] => {
  const needle = word.trim().toLowerCase();

  if (needle.length < 2) return [];

  return Object.entries(COLUMN_GLOSSARY)
    .filter(([, entry]) =>
      (entry.aliases ?? []).some((alias) =>
        alias.toLowerCase().includes(needle),
      ),
    )
    .map(([key]) => key)
    .sort();
};
