import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { firmCurrentFiling } from '@orm/app/sql/firmCurrentFiling.js';
import { firmProfileFacets } from '@orm/app/sql/firmProfileFacets.js';
import { firmReportedClients } from '@orm/app/sql/firmReportedClients.js';
import { AppPrismaService } from '@system/database/database.service.js';

import { toCount, toMoney } from '../decimal.js';

import type {
  GetFirmProfileDto,
  GetFirmProfileResponseDto,
} from '../dto/firms.dto.js';

export class GetFirmProfileQuery extends Query<GetFirmProfileResponseDto> {
  constructor(public readonly dto: GetFirmProfileDto) {
    super();
  }
}

type ReportedClientQuality =
  'reported_number' | 'bounded_range' | 'unavailable';

const toReportedClientQuality = (
  value: string | null | undefined,
): ReportedClientQuality => {
  switch (value) {
    case 'reported_number':
    case 'bounded_range':
      return value;
    default:
      return 'unavailable';
  }
};

@QueryHandler(GetFirmProfileQuery)
export class GetFirmProfileQueryHandler implements IQueryHandler<GetFirmProfileQuery> {
  constructor(private readonly appPrismaService: AppPrismaService) {}

  async execute({
    dto,
  }: GetFirmProfileQuery): Promise<GetFirmProfileResponseDto> {
    const [rows, current, reportedClientRows] = await Promise.all([
      this.appPrismaService.$queryRawTyped(firmProfileFacets(dto.firmCrd)),
      this.appPrismaService.$queryRawTyped(firmCurrentFiling(dto.firmCrd)),
      this.appPrismaService.$queryRawTyped(firmReportedClients(dto.firmCrd)),
    ]);
    const reportedClients = reportedClientRows[0];

    const of = (facet: string) =>
      rows.flatMap((row) =>
        row.facet === facet && row.code !== null
          ? [
              {
                code: row.code,
                label: row.label,
                clientCount: toCount(row.client_count),
                fewerThanFive: row.fewer_than_five,
                regulatoryAum: toMoney(row.regulatory_aum),
              },
            ]
          : [],
      );

    return {
      clientTypes: of('client_type'),
      services: of('service'),
      feeMethods: of('fee_method'),
      reportedClients: {
        min: toCount(reportedClients?.reported_client_count_min ?? null),
        max: toCount(reportedClients?.reported_client_count_max ?? null),
        quality: toReportedClientQuality(
          reportedClients?.reported_client_count_quality,
        ),
      },
      filingId: current[0]?.filing_id ?? null,
    };
  }
}
