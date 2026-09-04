import { describe, expect, it } from 'vitest';

import type { AgentFilter } from './agent-filter.schema.js';
import {
  decodeAgentFilter,
  encodeAgentFilter,
  OPEN_URL_MAX,
  openUrlFor,
} from './agent-filter-url.js';

const filter: AgentFilter = {
  all: [
    { field: 'advisor.state', op: 'isAnyOf', value: ['TX'] },
    { field: 'advisor.firm_aum', op: 'isGreaterThan', value: 2_000_000_000 },
  ],
  any: [],
  none: [{ field: 'advisor.firm_channel', op: 'isAnyOf', value: ['hybrid'] }],
};

describe('agent filter url', () => {
  it('round-trips through a url-safe token', () => {
    const token = encodeAgentFilter(filter);

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeAgentFilter(token)).toEqual(filter);
  });

  it('returns null for a token that is not a filter', () => {
    expect(decodeAgentFilter('not base64 json')).toBeNull();
  });

  it('carries the filter when it fits and drops it when it would not', () => {
    expect(openUrlFor('/prospecting/advisors', filter)).toEqual({
      openUrl: `/prospecting/advisors?f=${encodeAgentFilter(filter)}`,
      openUrlCarriesFilter: true,
    });
    expect(openUrlFor('/prospecting/advisors', null)).toEqual({
      openUrl: '/prospecting/advisors',
      openUrlCarriesFilter: false,
    });

    const huge: AgentFilter = {
      all: Array.from({ length: 200 }, (_, i) => ({
        field: 'advisor.previous_firm_crds',
        op: 'isAnyOf',
        value: [String(100000 + i)],
      })),
      any: [],
      none: [],
    };
    const result = openUrlFor('/prospecting/advisors', huge);

    expect(result.openUrlCarriesFilter).toBe(false);
    expect(result.openUrl.length).toBeLessThanOrEqual(OPEN_URL_MAX);
  });
});
