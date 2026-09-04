import type { AgentFilter } from '../filter/agent-filter.schema.js';

export type GoldenKind = 'numeric' | 'time' | 'credential' | 'shape' | 'null';

export type GoldenCase = {
  id: string;
  kind: GoldenKind;
  sourceKind: 'advisor' | 'firm';
  prompt: string;
  expect:
    | { filter: AgentFilter; countOnly?: boolean }
    | { clarify: string }
    | { unavailable: string };
};

const f = (partial: Partial<AgentFilter>): AgentFilter => ({
  all: partial.all ?? [],
  any: partial.any ?? [],
  none: partial.none ?? [],
});

/**
 * What a correct filter looks like for the requests recruiters actually make.
 * Field choices are the contract; the unit spec proves every expected filter
 * compiles, and the model eval scores the assistant against these.
 */
export const GOLDEN_CASES: readonly GoldenCase[] = [
  // numeric thresholds and ranges
  {
    id: 'num-firms-over-2b-tx',
    kind: 'numeric',
    sourceKind: 'firm',
    prompt: 'firms over $2B in Texas',
    expect: {
      filter: f({
        all: [
          {
            field: 'firm.regulatory_aum',
            op: 'isGreaterThan',
            value: 2_000_000_000,
          },
          { field: 'firm.state', op: 'isAnyOf', value: ['TX'] },
        ],
      }),
    },
  },
  {
    id: 'num-advisers-firms-under-20',
    kind: 'numeric',
    sourceKind: 'advisor',
    prompt: 'advisers at firms with fewer than 20 advisers',
    expect: {
      filter: f({
        all: [
          { field: 'advisor.firm_advisor_count', op: 'isLessThan', value: 20 },
        ],
      }),
    },
  },
  {
    id: 'num-firms-5-to-20-advisers',
    kind: 'numeric',
    sourceKind: 'firm',
    prompt: 'firms with between 5 and 20 advisers',
    expect: {
      filter: f({
        all: [{ field: 'firm.advisor_count', op: 'isBetween', value: [5, 20] }],
      }),
    },
  },
  {
    id: 'num-tenure-under-3',
    kind: 'numeric',
    sourceKind: 'advisor',
    prompt: 'advisers with tenure under 3 years in California',
    expect: {
      filter: f({
        all: [
          { field: 'advisor.tenure_years', op: 'isLessThan', value: 3 },
          { field: 'advisor.state', op: 'isAnyOf', value: ['CA'] },
        ],
      }),
    },
  },
  {
    id: 'num-experience-over-10',
    kind: 'numeric',
    sourceKind: 'advisor',
    prompt: 'advisers with more than 10 years in the industry at $1B+ firms',
    expect: {
      filter: f({
        all: [
          { field: 'advisor.experience_years', op: 'isGreaterThan', value: 10 },
          {
            field: 'advisor.firm_aum',
            op: 'isGreaterThan',
            value: 1_000_000_000,
          },
        ],
      }),
    },
  },
  {
    id: 'num-aum-per-adviser',
    kind: 'numeric',
    sourceKind: 'firm',
    prompt: 'firms with more than $100M of AUM per adviser',
    expect: {
      filter: f({
        all: [
          {
            field: 'firm.aum_per_advisor',
            op: 'isGreaterThan',
            value: 100_000_000,
          },
        ],
      }),
    },
  },
  {
    id: 'num-band-explicit',
    kind: 'numeric',
    sourceKind: 'advisor',
    prompt: 'advisers in the $1B to $5B AUM band',
    expect: {
      filter: f({
        all: [
          { field: 'advisor.firm_aum_band', op: 'isAnyOf', value: ['1b_5b'] },
        ],
      }),
    },
  },
  {
    id: 'num-growth-firms',
    kind: 'numeric',
    sourceKind: 'firm',
    prompt: 'firms growing AUM more than 10% a year over three years',
    expect: {
      filter: f({
        all: [{ field: 'firm.aum_cagr_3y', op: 'isGreaterThan', value: 0.1 }],
      }),
    },
  },
  {
    id: 'num-top-decile',
    kind: 'numeric',
    sourceKind: 'firm',
    prompt: 'top 10% of firms by AUM in Florida',
    expect: {
      filter: f({
        all: [
          { field: 'firm.aum_percentile', op: 'isGreaterThan', value: 90 },
          { field: 'firm.state', op: 'isAnyOf', value: ['FL'] },
        ],
      }),
    },
  },
  {
    id: 'num-count-only',
    kind: 'numeric',
    sourceKind: 'advisor',
    prompt: 'how many advisers are in New York?',
    expect: {
      filter: f({
        all: [{ field: 'advisor.state', op: 'isAnyOf', value: ['NY'] }],
      }),
      countOnly: true,
    },
  },

  // time windows and movement
  {
    id: 'time-moved-6-months',
    kind: 'time',
    sourceKind: 'advisor',
    prompt: 'advisers who moved in the last 6 months',
    expect: {
      filter: f({
        all: [
          {
            field: 'advisor.last_moved_on',
            op: 'isWithinLastNDays',
            value: 180,
          },
        ],
      }),
    },
  },
  {
    id: 'time-moved-90-days-ca',
    kind: 'time',
    sourceKind: 'advisor',
    prompt: 'which advisers in California moved in the last 90 days?',
    expect: {
      filter: f({
        all: [
          { field: 'advisor.state', op: 'isAnyOf', value: ['CA'] },
          {
            field: 'advisor.last_moved_on',
            op: 'isWithinLastNDays',
            value: 90,
          },
        ],
      }),
    },
  },
  {
    id: 'time-joined-since-january',
    kind: 'time',
    sourceKind: 'advisor',
    prompt: 'advisers who joined their firm since January',
    expect: {
      filter: f({
        all: [
          {
            field: 'advisor.current_firm_since',
            op: 'isAfter',
            value: '2026-01-01',
          },
        ],
      }),
    },
  },
  {
    id: 'time-firms-losing-quarter',
    kind: 'time',
    sourceKind: 'firm',
    prompt: 'firms losing advisers this quarter',
    expect: {
      filter: f({
        all: [
          { field: 'firm.advisors_lost_90d', op: 'isGreaterThan', value: 0 },
        ],
      }),
    },
  },
  {
    id: 'time-firms-net-shrinking',
    kind: 'time',
    sourceKind: 'firm',
    prompt: 'firms with net adviser departures recently',
    expect: {
      filter: f({
        all: [
          { field: 'firm.net_advisor_flow_90d', op: 'isLessThan', value: 0 },
        ],
      }),
    },
  },
  {
    id: 'time-firms-hiring',
    kind: 'time',
    sourceKind: 'firm',
    prompt: 'firms that added advisers in the last 90 days in Texas',
    expect: {
      filter: f({
        all: [
          { field: 'firm.advisors_gained_90d', op: 'isGreaterThan', value: 0 },
          { field: 'firm.state', op: 'isAnyOf', value: ['TX'] },
        ],
      }),
    },
  },
  {
    id: 'time-tenure-recent-joiners',
    kind: 'time',
    sourceKind: 'advisor',
    prompt: 'advisers less than a year into their current firm',
    expect: {
      filter: f({
        all: [{ field: 'advisor.tenure_months', op: 'isLessThan', value: 12 }],
      }),
    },
  },
  {
    id: 'time-frequent-movers',
    kind: 'time',
    sourceKind: 'advisor',
    prompt: 'advisers who changed firms at least twice in five years',
    expect: {
      filter: f({
        all: [
          { field: 'advisor.move_count_5y', op: 'isGreaterThan', value: 1 },
        ],
      }),
    },
  },
  {
    id: 'time-moved-between-dates',
    kind: 'time',
    sourceKind: 'advisor',
    prompt: 'advisers who moved between March and June 2026',
    expect: {
      filter: f({
        all: [
          {
            field: 'advisor.last_moved_on',
            op: 'isBetween',
            value: ['2026-03-01', '2026-06-30'],
          },
        ],
      }),
    },
  },
  {
    id: 'time-left-a-firm',
    kind: 'time',
    sourceKind: 'advisor',
    prompt: 'advisers who recently left UBS (CRD 8174)',
    expect: {
      filter: f({
        all: [
          { field: 'advisor.previous_firm_crd', op: 'is', value: 8174 },
          {
            field: 'advisor.last_moved_on',
            op: 'isWithinLastNDays',
            value: 180,
          },
        ],
      }),
    },
  },

  // credentials by name
  {
    id: 'cred-cfp-fl-small-firms',
    kind: 'credential',
    sourceKind: 'advisor',
    prompt: 'who holds the CFP at firms under 20 advisers in Florida?',
    expect: {
      filter: f({
        all: [
          {
            field: 'advisor.designations',
            op: 'isAnyOf',
            value: ['Certified Financial Planner'],
          },
          { field: 'advisor.firm_advisor_count', op: 'isLessThan', value: 20 },
          { field: 'advisor.state', op: 'isAnyOf', value: ['FL'] },
        ],
      }),
    },
  },
  {
    id: 'cred-series-65-and-63',
    kind: 'credential',
    sourceKind: 'advisor',
    prompt: 'advisers with the Series 65 and 63',
    expect: {
      filter: f({
        all: [
          { field: 'advisor.exam_codes', op: 'isAnyOf', value: ['S65'] },
          { field: 'advisor.exam_codes', op: 'isAnyOf', value: ['S65'] },
        ],
      }),
    },
  },
  {
    id: 'cred-series-65-or-66',
    kind: 'credential',
    sourceKind: 'advisor',
    prompt: 'advisers with either the Series 65 or 66',
    expect: {
      filter: f({
        all: [
          { field: 'advisor.exam_codes', op: 'isAnyOf', value: ['S65', 'S66'] },
        ],
      }),
    },
  },
  {
    id: 'cred-cfa-and-cfp',
    kind: 'credential',
    sourceKind: 'advisor',
    prompt: 'advisers who are both CFA and CFP charterholders',
    expect: {
      filter: f({
        all: [
          {
            field: 'advisor.designations',
            op: 'isAnyOf',
            value: ['Chartered Financial Analyst'],
          },
          {
            field: 'advisor.designations',
            op: 'isAnyOf',
            value: ['Certified Financial Planner'],
          },
        ],
      }),
    },
  },
  {
    id: 'cred-no-disclosures',
    kind: 'credential',
    sourceKind: 'advisor',
    prompt: 'advisers with no disclosures in Texas',
    expect: {
      filter: f({
        all: [
          {
            field: 'advisor.disclosure_status',
            op: 'isAnyOf',
            value: ['none_reported'],
          },
          { field: 'advisor.state', op: 'isAnyOf', value: ['TX'] },
        ],
      }),
    },
  },
  {
    id: 'cred-with-disclosures',
    kind: 'credential',
    sourceKind: 'advisor',
    prompt: 'advisers with more than one disclosure',
    expect: {
      filter: f({
        all: [
          { field: 'advisor.disclosure_count', op: 'isGreaterThan', value: 1 },
        ],
      }),
    },
  },
  {
    id: 'cred-no-series-66',
    kind: 'credential',
    sourceKind: 'advisor',
    prompt: 'CFPs who do not hold the Series 66',
    expect: {
      filter: f({
        all: [
          {
            field: 'advisor.designations',
            op: 'isAnyOf',
            value: ['Certified Financial Planner'],
          },
          { field: 'advisor.exam_codes', op: 'isNoneOf', value: ['S66'] },
        ],
      }),
    },
  },
  {
    id: 'cred-licensed-in-states',
    kind: 'credential',
    sourceKind: 'advisor',
    prompt: 'advisers registered in both New York and New Jersey',
    expect: {
      filter: f({
        all: [
          { field: 'advisor.jurisdictions', op: 'isAnyOf', value: ['NY'] },
          { field: 'advisor.jurisdictions', op: 'isAnyOf', value: ['NJ'] },
        ],
      }),
    },
  },
  {
    id: 'cred-chfc-or-pfs',
    kind: 'credential',
    sourceKind: 'advisor',
    prompt: 'ChFC or PFS designation holders at $500M+ firms',
    expect: {
      filter: f({
        all: [
          {
            field: 'advisor.firm_aum',
            op: 'isGreaterThan',
            value: 500_000_000,
          },
        ],
        any: [
          {
            field: 'advisor.designations',
            op: 'isAnyOf',
            value: [
              'Chartered Financial Consultant',
              'Personal Financial Specialist',
            ],
          },
        ],
      }),
    },
  },
  {
    id: 'cred-cic',
    kind: 'credential',
    sourceKind: 'advisor',
    prompt: 'advisers holding the Chartered Investment Counselor designation',
    expect: {
      filter: f({
        all: [
          {
            field: 'advisor.designations',
            op: 'isAnyOf',
            value: ['Chartered Investment Counselor'],
          },
        ],
      }),
    },
  },

  // firm shape and exclusions
  {
    id: 'shape-independent-only',
    kind: 'shape',
    sourceKind: 'firm',
    prompt: 'independent RIAs only in Illinois',
    expect: {
      filter: f({
        all: [
          { field: 'firm.channel_code', op: 'isAnyOf', value: ['pure_ria'] },
          { field: 'firm.state', op: 'isAnyOf', value: ['IL'] },
        ],
      }),
    },
  },
  {
    id: 'shape-not-hybrids',
    kind: 'shape',
    sourceKind: 'advisor',
    prompt: 'advisers in Texas, not at hybrids',
    expect: {
      filter: f({
        all: [
          { field: 'advisor.state', op: 'isAnyOf', value: ['TX'] },
          { field: 'advisor.firm_channel', op: 'isNoneOf', value: ['hybrid'] },
        ],
      }),
    },
  },
  {
    id: 'shape-independent-losing',
    kind: 'shape',
    sourceKind: 'firm',
    prompt: 'independent RIAs only, not hybrids, losing advisers this quarter',
    expect: {
      filter: f({
        all: [
          { field: 'firm.channel_code', op: 'isAnyOf', value: ['pure_ria'] },
          { field: 'firm.advisors_lost_90d', op: 'isGreaterThan', value: 0 },
        ],
      }),
    },
  },
  {
    id: 'shape-exclude-named-firms',
    kind: 'shape',
    sourceKind: 'advisor',
    prompt:
      'advisers in California excluding Morgan Stanley (149777) and Merrill (7691)',
    expect: {
      filter: f({
        all: [{ field: 'advisor.state', op: 'isAnyOf', value: ['CA'] }],
        none: [
          { field: 'advisor.current_firm_crd', op: 'is', value: 149777 },
          { field: 'advisor.current_firm_crd', op: 'is', value: 7691 },
        ],
      }),
    },
  },
  {
    id: 'shape-bd-affiliated',
    kind: 'shape',
    sourceKind: 'firm',
    prompt: 'broker-dealer affiliated firms with over $1B',
    expect: {
      filter: f({
        all: [
          {
            field: 'firm.channel_code',
            op: 'isAnyOf',
            value: ['bd_affiliated'],
          },
          {
            field: 'firm.regulatory_aum',
            op: 'isGreaterThan',
            value: 1_000_000_000,
          },
        ],
      }),
    },
  },
  {
    id: 'shape-era-excluded',
    kind: 'shape',
    sourceKind: 'firm',
    prompt:
      'registered advisers only, no exempt reporting advisers, in Massachusetts',
    expect: {
      filter: f({
        all: [
          { field: 'firm.is_era', op: 'is', value: false },
          { field: 'firm.state', op: 'isAnyOf', value: ['MA'] },
        ],
      }),
    },
  },
  {
    id: 'shape-alumni-of-firm',
    kind: 'shape',
    sourceKind: 'advisor',
    prompt: 'advisers who used to work at UBS (8174)',
    expect: {
      filter: f({
        all: [
          { field: 'advisor.previous_firm_crds', op: 'isAnyOf', value: [8174] },
        ],
      }),
    },
  },
  {
    id: 'shape-owners',
    kind: 'shape',
    sourceKind: 'advisor',
    prompt: 'advisers who own their firm in Georgia',
    expect: {
      filter: f({
        all: [
          { field: 'advisor.owns_current_firm', op: 'is', value: true },
          { field: 'advisor.state', op: 'isAnyOf', value: ['GA'] },
        ],
      }),
    },
  },
  {
    id: 'shape-hq-vs-location',
    kind: 'shape',
    sourceKind: 'advisor',
    prompt: 'advisers at firms headquartered in Connecticut',
    expect: {
      filter: f({
        all: [{ field: 'advisor.firm_state', op: 'isAnyOf', value: ['CT'] }],
      }),
    },
  },
  {
    id: 'shape-small-independent-any-state',
    kind: 'shape',
    sourceKind: 'advisor',
    prompt: 'advisers at small independent RIAs in Texas or Florida',
    expect: {
      filter: f({
        all: [
          { field: 'advisor.firm_channel', op: 'isAnyOf', value: ['pure_ria'] },
          { field: 'advisor.firm_advisor_count', op: 'isLessThan', value: 20 },
          { field: 'advisor.state', op: 'isAnyOf', value: ['TX', 'FL'] },
        ],
      }),
    },
  },

  // null discipline: no search on the unavailable field, honest answer
  {
    id: 'null-custodian',
    kind: 'null',
    sourceKind: 'firm',
    prompt: 'firms custodied at Schwab',
    expect: { unavailable: 'custodian' },
  },
  {
    id: 'null-series-7',
    kind: 'null',
    sourceKind: 'advisor',
    prompt: 'advisers with the Series 7 in Texas',
    expect: { unavailable: 'series 7' },
  },
  {
    id: 'null-wirehouse',
    kind: 'null',
    sourceKind: 'advisor',
    prompt: 'advisers at wirehouses in Texas',
    expect: { unavailable: 'wirehouse' },
  },
  {
    id: 'null-contact',
    kind: 'null',
    sourceKind: 'advisor',
    prompt: 'give me the emails of CFPs in Texas',
    expect: { unavailable: 'email' },
  },
  {
    id: 'null-never-moved',
    kind: 'null',
    sourceKind: 'advisor',
    prompt: 'advisers who have never changed firms',
    expect: { clarify: 'null movement means not observed, not never moved' },
  },
  {
    id: 'null-attrition-this-year',
    kind: 'null',
    sourceKind: 'firm',
    prompt: 'firms that lost advisers this year',
    expect: { clarify: 'only a fixed 90-day window exists' },
  },
  {
    id: 'null-aum-ambiguous',
    kind: 'null',
    sourceKind: 'advisor',
    prompt: 'advisers managing over $2B',
    expect: { clarify: 'firm AUM vs AUM per adviser' },
  },
  {
    id: 'null-state-registered',
    kind: 'null',
    sourceKind: 'firm',
    prompt: 'state-registered advisers in Ohio',
    expect: { unavailable: 'state-registered' },
  },
  {
    id: 'null-fee-only',
    kind: 'null',
    sourceKind: 'firm',
    prompt: 'fee-only firms in Texas',
    expect: { clarify: 'fee method codes, empty means unknown' },
  },
  {
    id: 'null-detection-latency',
    kind: 'null',
    sourceKind: 'advisor',
    prompt: 'moves we detected in the last week',
    expect: { clarify: 'detection date equals the load date' },
  },
  {
    id: 'null-zero-vs-unknown-disclosures',
    kind: 'null',
    sourceKind: 'advisor',
    prompt: 'advisers with zero disclosures',
    expect: {
      filter: f({
        all: [
          {
            field: 'advisor.disclosure_status',
            op: 'isAnyOf',
            value: ['none_reported'],
          },
        ],
      }),
    },
  },
];
