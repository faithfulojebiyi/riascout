import { describe, expect, it } from 'vitest';

import { formatClientTypeCount, formatReportedClients } from './client-metrics';

describe('client metric formatting', () => {
  it('renders exact reported-client counts', () => {
    expect(
      formatReportedClients({
        min: 2703720,
        max: 2703720,
        quality: 'reported_number',
      }),
    ).toBe('2,703,720');
  });

  it('renders fewer-than-five totals as their bounded range', () => {
    expect(
      formatReportedClients({ min: 1, max: 4, quality: 'bounded_range' }),
    ).toBe('1–4');
  });

  it('does not turn unavailable clients into zero', () => {
    expect(
      formatReportedClients({ min: null, max: null, quality: 'unavailable' }),
    ).toBe('Not reported');
  });

  it('preserves fewer-than-five client-type answers', () => {
    expect(
      formatClientTypeCount({ clientCount: null, fewerThanFive: true }),
    ).toBe('Fewer than 5 clients');
  });
});
