import { describe, expect, it } from 'vitest';

import {
  GetFirmFundsResponseSchema,
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

describe('private-fund filing contracts', () => {
  it('preserves nullable questionnaire values without collapsing false or zero', () => {
    const parsed = GetFirmFundsResponseSchema.parse({
      funds: [
        {
          privateFundId: 'PF-1',
          fundReference: 'REF-1',
          fundName: 'Alpha Fund',
          fundTypeCode: 'hedge',
          fundTypeRaw: 'Hedge Fund',
          fundTypeOther: null,
          region: 'NY',
          country: 'UNITED STATES',
          exclusion3c1: true,
          exclusion3c7: false,
          isMasterFund: false,
          isFeederFund: false,
          masterFundName: null,
          masterFundId: null,
          isFundOfFunds: false,
          adviserOrRelatedInvested: true,
          investedInRegisteredInvestmentCompanies: false,
          grossAssetValue: '1000.00',
          minimumInvestment: '0.00',
          beneficialOwnerCount: 0,
          ownedByAdviserRelatedPct: '0.00000000',
          ownedByFundsPct: null,
          salesLimitedToQualifiedClients: true,
          ownedByNonUsPct: null,
          isSubadviser: false,
          hasOtherAdvisers: true,
          clientsSolicited: false,
          clientsInvestedPct: null,
          reliedOnRegulationD: true,
          annualAudit: true,
          financialStatementsGaap: true,
          financialStatementsDistributed: true,
          auditOpinionStatus: 'report_not_yet_received',
          usesPrimeBrokers: true,
          usesCustodians: true,
          usesAdministrator: true,
          externallyValuedAssetsPct: '0.00000000',
          usesMarketers: false,
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
      filingId: 'F-1',
    });

    expect(parsed.funds[0]?.exclusion3c7).toBe(false);
    expect(parsed.funds[0]?.minimumInvestment).toBe('0.00');
    expect(parsed.funds[0]?.auditOpinionStatus).toBe('report_not_yet_received');
  });
});
