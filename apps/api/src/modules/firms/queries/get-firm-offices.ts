import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { firmCurrentFiling } from '@orm/app/sql/firmCurrentFiling.js';
import { AppPrismaService } from '@system/database/database.service.js';

import { toCount } from '../decimal.js';

import type {
  GetFirmOfficesDto,
  GetFirmOfficesResponseDto,
} from '../dto/firms.dto.js';

export class GetFirmOfficesQuery extends Query<GetFirmOfficesResponseDto> {
  constructor(public readonly dto: GetFirmOfficesDto) {
    super();
  }
}

@QueryHandler(GetFirmOfficesQuery)
export class GetFirmOfficesQueryHandler
  implements IQueryHandler<GetFirmOfficesQuery>
{
  constructor(private readonly appPrismaService: AppPrismaService) {}

  async execute({
    dto,
  }: GetFirmOfficesQuery): Promise<GetFirmOfficesResponseDto> {
    const current = await this.appPrismaService.$queryRawTyped(
      firmCurrentFiling(dto.firmCrd),
    );
    const filingId = current[0]?.filing_id ?? null;

    if (filingId === null) {
      return { offices: [], filingId: null };
    }

    /**
     * Keyed by filing, never by firm: firm_fact_office is 1,039,757 rows across
     * the whole filing history, and the tab wants the current one.
     */
    const offices = await this.appPrismaService.firmFactOffice.findMany({
      where: { filingId },
      orderBy: [{ employeeCount: 'desc' }, { city: 'asc' }],
    });

    return {
      offices: offices.map((o) => ({
        officeReference: o.officeReference,
        city: o.city,
        region: o.regionRaw,
        country: o.countryRaw,
        employeeCount: toCount(o.employeeCount),
      })),
      filingId,
    };
  }
}
