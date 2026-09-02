import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { firmMetricsSeries } from '@orm/app/sql/firmMetricsSeries.js';
import { AppPrismaService } from '@system/database/database.service.js';

import { toCount, toMoney } from '../decimal.js';

import type {
  GetFirmMetricsSeriesDto,
  GetFirmMetricsSeriesResponseDto,
} from '../dto/firms.dto.js';

export class GetFirmMetricsSeriesQuery extends Query<GetFirmMetricsSeriesResponseDto> {
  constructor(public readonly dto: GetFirmMetricsSeriesDto) {
    super();
  }
}

@QueryHandler(GetFirmMetricsSeriesQuery)
export class GetFirmMetricsSeriesQueryHandler implements IQueryHandler<GetFirmMetricsSeriesQuery> {
  constructor(private readonly appPrismaService: AppPrismaService) {}

  async execute({
    dto,
  }: GetFirmMetricsSeriesQuery): Promise<GetFirmMetricsSeriesResponseDto> {
    const [points, filingCount] = await Promise.all([
      this.appPrismaService.$queryRawTyped(firmMetricsSeries(dto.firmCrd)),
      this.appPrismaService.filing.count({ where: { firmCrd: dto.firmCrd } }),
    ]);

    return {
      points: points.map((p) => ({
        filingId: p.filing_id,
        submittedAt: p.submitted_at?.toISOString() ?? null,
        filingType: p.filing_type,
        regulatoryAum: toMoney(p.regulatory_aum),
        discretionaryAum: toMoney(p.discretionary_aum),
        nonDiscretionaryAum: toMoney(p.non_discretionary_aum),
        employeeCount: toCount(p.employee_count),
        advisoryEmployeeCount: toCount(p.advisory_employee_count),
        discretionaryAccountCount: toCount(p.discretionary_account_count),
        nonDiscretionaryAccountCount: toCount(
          p.non_discretionary_account_count,
        ),
        accountCount: toCount(p.account_count),
        officeCount: toCount(p.office_count),
      })),
      filingCount,
      basis: 'submitted_at',
    };
  }
}
