import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { firmCurrentFiling } from '@orm/app/sql/firmCurrentFiling.js';
import { AppPrismaService } from '@system/database/database.service.js';

import { toCount, toMoney } from '../decimal.js';

import type {
  GetFirmFundsDto,
  GetFirmFundsResponseDto,
} from '../dto/firms.dto.js';

export class GetFirmFundsQuery extends Query<GetFirmFundsResponseDto> {
  constructor(public readonly dto: GetFirmFundsDto) {
    super();
  }
}

type AuditOpinionStatus =
  'unqualified' | 'not_unqualified' | 'report_not_yet_received';

const toAuditOpinionStatus = (
  value: string | null,
): AuditOpinionStatus | null => {
  if (value === null) return null;
  switch (value) {
    case 'unqualified':
    case 'not_unqualified':
    case 'report_not_yet_received':
      return value;
    default:
      throw new Error(`Invalid private-fund audit opinion status: ${value}`);
  }
};

@QueryHandler(GetFirmFundsQuery)
export class GetFirmFundsQueryHandler implements IQueryHandler<GetFirmFundsQuery> {
  constructor(private readonly appPrismaService: AppPrismaService) {}

  async execute({ dto }: GetFirmFundsQuery): Promise<GetFirmFundsResponseDto> {
    const current = await this.appPrismaService.$queryRawTyped(
      firmCurrentFiling(dto.firmCrd),
    );
    const filingId = current[0]?.filing_id ?? null;

    if (filingId === null) {
      return {
        funds: [],
        total: 0,
        limit: dto.limit,
        offset: dto.offset,
        filingId: null,
      };
    }

    // paged because one filing can carry 22,277 funds
    const [funds, total] = await Promise.all([
      this.appPrismaService.firmFactPrivateFund.findMany({
        where: { filingId },
        orderBy: [{ grossAssetValue: 'desc' }, { privateFundId: 'asc' }],
        take: dto.limit,
        skip: dto.offset,
      }),
      this.appPrismaService.firmFactPrivateFund.count({ where: { filingId } }),
    ]);

    return {
      funds: funds.map((f) => ({
        privateFundId: f.privateFundId,
        fundReference: f.fundReference,
        fundName: f.fundName,
        fundTypeCode: f.fundTypeCode,
        fundTypeRaw: f.fundTypeRaw,
        fundTypeOther: f.fundTypeOther,
        region: f.regionRaw,
        country: f.countryRaw,
        exclusion3c1: f.exclusion3c1,
        exclusion3c7: f.exclusion3c7,
        isMasterFund: f.isMasterFund,
        isFeederFund: f.isFeederFund,
        masterFundName: f.masterFundName,
        masterFundId: f.masterFundId,
        isFundOfFunds: f.isFundOfFunds,
        adviserOrRelatedInvested: f.adviserOrRelatedInvested,
        investedInRegisteredInvestmentCompanies:
          f.investedInRegisteredInvestmentCompanies,
        grossAssetValue: toMoney(f.grossAssetValue),
        minimumInvestment: toMoney(f.minimumInvestment),
        beneficialOwnerCount: toCount(f.beneficialOwnerCount),
        ownedByAdviserRelatedPct: toMoney(f.ownedByAdviserRelatedPct),
        ownedByFundsPct: toMoney(f.ownedByFundsPct),
        salesLimitedToQualifiedClients: f.salesLimitedToQualifiedClients,
        ownedByNonUsPct: toMoney(f.ownedByNonUsPct),
        isSubadviser: f.isSubadviser,
        hasOtherAdvisers: f.hasOtherAdvisers,
        clientsSolicited: f.clientsSolicited,
        clientsInvestedPct: toMoney(f.clientsInvestedPct),
        reliedOnRegulationD: f.reliedOnRegulationD,
        annualAudit: f.annualAudit,
        financialStatementsGaap: f.financialStatementsGaap,
        financialStatementsDistributed: f.financialStatementsDistributed,
        auditOpinionStatus: toAuditOpinionStatus(f.auditOpinionStatus),
        usesPrimeBrokers: f.usesPrimeBrokers,
        usesCustodians: f.usesCustodians,
        usesAdministrator: f.usesAdministrator,
        externallyValuedAssetsPct: toMoney(f.externallyValuedAssetsPct),
        usesMarketers: f.usesMarketers,
      })),
      total,
      limit: dto.limit,
      offset: dto.offset,
      filingId,
    };
  }
}
