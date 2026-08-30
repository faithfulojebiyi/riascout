import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { AppPrismaService } from '@system/database/database.service.js';

import type {
  GetFirmFlowsDto,
  GetFirmFlowsResponseDto,
} from '../dto/movement.dto.js';

export class GetFirmFlowsQuery extends Query<GetFirmFlowsResponseDto> {
  constructor(public readonly dto: GetFirmFlowsDto) {
    super();
  }
}

type Row = {
  firm_crd: bigint;
  firm_name: string | null;
  gained: number;
  lost: number;
  net: number;
};

@QueryHandler(GetFirmFlowsQuery)
export class GetFirmFlowsQueryHandler implements IQueryHandler<GetFirmFlowsQuery> {
  constructor(private readonly appPrismaService: AppPrismaService) {}

  /** market data is global, so no workspace scoping applies here */
  async execute({ dto }: GetFirmFlowsQuery): Promise<GetFirmFlowsResponseDto> {
    const rows = await this.appPrismaService.$queryRawUnsafe<Row[]>(
      `SELECT d.firm_crd, s.firm_name,
              sum(d.advisors_gained)::int AS gained,
              sum(d.advisors_lost)::int   AS lost,
              sum(d.net_flow)::int        AS net
         FROM market.firm_movement_daily d
         LEFT JOIN market.firm_search s ON s.firm_crd = d.firm_crd
        WHERE d.day > current_date - $1::int
        GROUP BY d.firm_crd, s.firm_name
        ORDER BY sum(d.net_flow) ${dto.direction === 'gaining' ? 'DESC' : 'ASC'}
        LIMIT $2`,
      dto.windowDays,
      dto.limit,
    );

    return {
      windowDays: dto.windowDays,
      basis: 'occurred_on',
      firms: rows.map((row) => ({
        firmCrd: String(row.firm_crd),
        firmName: row.firm_name,
        advisorsGained: row.gained,
        advisorsLost: row.lost,
        netFlow: row.net,
      })),
    };
  }
}
