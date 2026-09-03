import { describe, expect, it, vi } from 'vitest';

import { AppPrismaService } from '@system/database/database.service.js';

import {
  GetFirmFundsQuery,
  GetFirmFundsQueryHandler,
} from './get-firm-funds.js';

const decimal = (value: string): { toString: () => string } => ({
  toString: () => value,
});

describe('GetFirmFundsQueryHandler', () => {
  it('pages only the current filing and preserves complete scalar facts', async () => {
    const findMany = vi
      .fn<(args: unknown) => Promise<unknown[]>>()
      .mockResolvedValue([
        {
          filingId: 'F-CURRENT',
          privateFundId: 'PF-1',
          fundReference: 'REF-1',
          fundName: 'Alpha Fund',
          fundTypeCode: 'hedge',
          fundTypeRaw: 'Hedge Fund',
          fundTypeOther: null,
          regionRaw: 'NY',
          countryRaw: 'UNITED STATES',
          exclusion3c1: true,
          exclusion3c7: false,
          isMasterFund: false,
          isFeederFund: false,
          masterFundName: null,
          masterFundId: null,
          isFundOfFunds: false,
          adviserOrRelatedInvested: true,
          investedInRegisteredInvestmentCompanies: false,
          grossAssetValue: decimal('1000.00'),
          minimumInvestment: decimal('0.00'),
          beneficialOwnerCount: 0n,
          ownedByAdviserRelatedPct: decimal('0.00000000'),
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
          externallyValuedAssetsPct: decimal('0.00000000'),
          usesMarketers: false,
        },
      ]);
    const service = {
      $queryRawTyped: vi
        .fn<(query: unknown) => Promise<{ filing_id: string }[]>>()
        .mockResolvedValue([{ filing_id: 'F-CURRENT' }]),
      firmFactPrivateFund: {
        findMany,
        count: vi.fn<(args: unknown) => Promise<number>>().mockResolvedValue(1),
      },
    } as unknown as AppPrismaService;
    const handler = new GetFirmFundsQueryHandler(service);

    const result = await handler.execute(
      new GetFirmFundsQuery({ firmCrd: 123n, limit: 25, offset: 50 }),
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { filingId: 'F-CURRENT' },
        take: 25,
        skip: 50,
      }),
    );
    expect(result.funds[0]).toMatchObject({
      privateFundId: 'PF-1',
      exclusion3c7: false,
      minimumInvestment: '0.00',
      beneficialOwnerCount: 0,
      auditOpinionStatus: 'report_not_yet_received',
      externallyValuedAssetsPct: '0.00000000',
    });
    expect(result.total).toBe(1);
  });
});
