import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { firmCurrentFiling } from '@orm/app/sql/firmCurrentFiling.js';
import { AppPrismaService } from '@system/database/database.service.js';

import { toMoney } from '../decimal.js';

import type {
  GetFirmFundsDto,
  GetFirmFundsResponseDto,
} from '../dto/firms.dto.js';

export class GetFirmFundsQuery extends Query<GetFirmFundsResponseDto> {
  constructor(public readonly dto: GetFirmFundsDto) {
    super();
  }
}

@QueryHandler(GetFirmFundsQuery)
export class GetFirmFundsQueryHandler
  implements IQueryHandler<GetFirmFundsQuery>
{
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
        fundName: f.fundName,
        fundTypeCode: f.fundTypeCode,
        grossAssetValue: toMoney(f.grossAssetValue),
      })),
      total,
      limit: dto.limit,
      offset: dto.offset,
      filingId,
    };
  }
}
