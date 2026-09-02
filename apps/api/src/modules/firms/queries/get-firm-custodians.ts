import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { firmCurrentFiling } from '@orm/app/sql/firmCurrentFiling.js';
import { firmCustodianRollup } from '@orm/app/sql/firmCustodianRollup.js';
import { AppPrismaService } from '@system/database/database.service.js';

import { toMoney } from '../decimal.js';

import type {
  GetFirmCustodiansDto,
  GetFirmCustodiansResponseDto,
} from '../dto/firms.dto.js';

export class GetFirmCustodiansQuery extends Query<GetFirmCustodiansResponseDto> {
  constructor(public readonly dto: GetFirmCustodiansDto) {
    super();
  }
}

@QueryHandler(GetFirmCustodiansQuery)
export class GetFirmCustodiansQueryHandler
  implements IQueryHandler<GetFirmCustodiansQuery>
{
  constructor(private readonly appPrismaService: AppPrismaService) {}

  async execute({
    dto,
  }: GetFirmCustodiansQuery): Promise<GetFirmCustodiansResponseDto> {
    const [custodians, current] = await Promise.all([
      this.appPrismaService.$queryRawTyped(firmCustodianRollup(dto.firmCrd)),
      this.appPrismaService.$queryRawTyped(firmCurrentFiling(dto.firmCrd)),
    ]);

    return {
      custodians: custodians.map((c) => ({
        custodianName: c.custodian_name,
        isResolved: c.is_resolved ?? false,
        fundCount: Number(c.fund_count ?? 0),
        aumAtCustodian: toMoney(c.aum_at_custodian),
      })),
      // absent means the firm has never filed, not that it reported no custodian
      filingId: current[0]?.filing_id ?? null,
    };
  }
}
