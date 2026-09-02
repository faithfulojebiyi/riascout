import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { firmCurrentFiling } from '@orm/app/sql/firmCurrentFiling.js';
import { AppPrismaService } from '@system/database/database.service.js';

import type {
  GetFirmFilingsDto,
  GetFirmFilingsResponseDto,
} from '../dto/firms.dto.js';

export class GetFirmFilingsQuery extends Query<GetFirmFilingsResponseDto> {
  constructor(public readonly dto: GetFirmFilingsDto) {
    super();
  }
}

@QueryHandler(GetFirmFilingsQuery)
export class GetFirmFilingsQueryHandler
  implements IQueryHandler<GetFirmFilingsQuery>
{
  constructor(private readonly appPrismaService: AppPrismaService) {}

  async execute({
    dto,
  }: GetFirmFilingsQuery): Promise<GetFirmFilingsResponseDto> {
    /**
     * effective_date is null on every filing, so submittedAt is the only axis,
     * and filingId breaks the 496 same-instant ties.
     */
    const [filings, events, current] = await Promise.all([
      this.appPrismaService.filing.findMany({
        where: { firmCrd: dto.firmCrd },
        orderBy: [{ submittedAt: 'desc' }, { filingId: 'desc' }],
      }),
      this.appPrismaService.firmRegistrationEvent.findMany({
        where: { firmCrd: dto.firmCrd },
        orderBy: [{ effectiveDate: 'desc' }, { eventId: 'desc' }],
      }),
      this.appPrismaService.$queryRawTyped(firmCurrentFiling(dto.firmCrd)),
    ]);

    const currentId = current[0]?.filing_id ?? null;

    return {
      filings: filings.map((f) => ({
        filingId: f.filingId,
        submittedAt: f.submittedAt?.toISOString() ?? null,
        filingType: f.filingType,
        registrationCategory: f.registrationCategory,
        secNumber: f.secNumber,
        isCurrent: f.filingId === currentId,
      })),
      events: events.map((e) => ({
        eventId: e.eventId,
        authority: e.authority,
        category: e.category,
        status: e.status,
        jurisdiction: e.jurisdiction,
        effectiveDate: e.effectiveDate?.toISOString() ?? null,
      })),
    };
  }
}
