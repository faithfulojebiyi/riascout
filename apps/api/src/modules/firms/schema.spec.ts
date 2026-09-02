import { describe, expect, it } from 'vitest';

import {
  GetFirmMetricsSeriesResponseSchema,
  GetFirmProfileResponseSchema,
} from './schema.js';

describe('firm account and reported-client contracts', () => {
  it('names regulatory account metrics as accounts', () => {
    const parsed = GetFirmMetricsSeriesResponseSchema.parse({
      points: [
        {
          filingId: 'filing-1',
          submittedAt: '2026-01-01T00:00:00.000Z',
          filingType: 'ADV',
          regulatoryAum: '1000.00',
          discretionaryAum: '600.00',
          nonDiscretionaryAum: '400.00',
          employeeCount: 2,
          advisoryEmployeeCount: 1,
          discretionaryAccountCount: 6,
          nonDiscretionaryAccountCount: 4,
          accountCount: 10,
          officeCount: 1,
        },
      ],
      filingCount: 1,
      basis: 'submitted_at',
    });

    expect(parsed.points[0]?.accountCount).toBe(10);
    expect(parsed.points[0]).not.toHaveProperty('clientCount');
  });

  it('keeps reported clients separate and preserves bounded ranges', () => {
    const parsed = GetFirmProfileResponseSchema.parse({
      clientTypes: [
        {
          code: 'Individual',
          label: 'Individuals',
          clientCount: null,
          fewerThanFive: true,
          regulatoryAum: '500.00',
        },
      ],
      services: [],
      feeMethods: [],
      reportedClients: {
        min: 1,
        max: 4,
        quality: 'bounded_range',
      },
      filingId: 'filing-1',
    });

    expect(parsed.clientTypes[0]?.fewerThanFive).toBe(true);
    expect(parsed.reportedClients).toEqual({
      min: 1,
      max: 4,
      quality: 'bounded_range',
    });
  });
});
