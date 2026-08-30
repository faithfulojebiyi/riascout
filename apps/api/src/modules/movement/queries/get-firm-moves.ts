import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { AppPrismaService } from '@system/database/database.service.js';

import type {
  GetFirmMovesDto,
  GetFirmMovesResponseDto,
} from '../dto/movement.dto.js';

export class GetFirmMovesQuery extends Query<GetFirmMovesResponseDto> {
  constructor(public readonly dto: GetFirmMovesDto) {
    super();
  }
}

type Row = {
  advisor_crd: bigint;
  advisor_name: string | null;
  counterparty_crd: bigint | null;
  counterparty_name: string | null;
  occurred_on: Date | null;
  tenure_days: number | null;
};

@QueryHandler(GetFirmMovesQuery)
export class GetFirmMovesQueryHandler implements IQueryHandler<GetFirmMovesQuery> {
  constructor(private readonly appPrismaService: AppPrismaService) {}

  async execute({ dto }: GetFirmMovesQuery): Promise<GetFirmMovesResponseDto> {
    /**
     * Joining reads from to_firm_crd and shows where they came from; leaving
     * reads from from_firm_crd and shows where they went. The counterparty is
     * the opposite end either way.
     */
    const joining = dto.direction === 'in';
    const subject = joining ? 'to_firm_crd' : 'from_firm_crd';
    const counterparty = joining ? 'from_firm_crd' : 'to_firm_crd';

    const rows = await this.appPrismaService.$queryRawUnsafe<Row[]>(
      `SELECT m.advisor_crd, a.full_name AS advisor_name,
              m.${counterparty} AS counterparty_crd,
              f.firm_name       AS counterparty_name,
              m.occurred_on, m.tenure_days
         FROM market.advisor_move m
         LEFT JOIN market.advisor_search a ON a.advisor_crd = m.advisor_crd
         LEFT JOIN market.firm_search  f ON f.firm_crd = m.${counterparty}
        WHERE m.${subject} = $1::bigint
          AND m.occurred_on > (SELECT max(occurred_on) FROM market.advisor_move) - $2::int
        ORDER BY m.occurred_on DESC
        LIMIT $3`,
      dto.firmCrd,
      dto.windowDays,
      dto.limit,
    );

    return {
      moves: rows.map((row) => ({
        advisorCrd: String(row.advisor_crd),
        advisorName: row.advisor_name,
        counterpartyCrd:
          row.counterparty_crd === null ? null : String(row.counterparty_crd),
        counterpartyName: row.counterparty_name,
        occurredOn: row.occurred_on
          ? row.occurred_on.toISOString().slice(0, 10)
          : null,
        tenureDays: row.tenure_days,
      })),
    };
  }
}
