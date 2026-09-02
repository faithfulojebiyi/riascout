import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { firmCurrentFiling } from '@orm/app/sql/firmCurrentFiling.js';
import { firmProfileFacets } from '@orm/app/sql/firmProfileFacets.js';
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

type FacetRow = {
  facet: string | null;
  code: string | null;
  label: string | null;
  client_count: bigint | null;
  regulatory_aum: { toString: () => string } | null;
};

@QueryHandler(GetFirmProfileQuery)
export class GetFirmProfileQueryHandler
  implements IQueryHandler<GetFirmProfileQuery>
{
  constructor(private readonly appPrismaService: AppPrismaService) {}

  async execute({
    dto,
  }: GetFirmProfileQuery): Promise<GetFirmProfileResponseDto> {
    const [rows, current] = await Promise.all([
      this.appPrismaService.$queryRawTyped(firmProfileFacets(dto.firmCrd)),
      this.appPrismaService.$queryRawTyped(firmCurrentFiling(dto.firmCrd)),
    ]);

    const of = (facet: string) =>
      rows
        .filter((r: FacetRow) => r.facet === facet && r.code !== null)
        .map((r: FacetRow) => ({
          code: r.code as string,
          label: r.label,
          clientCount: toCount(r.client_count),
          regulatoryAum: toMoney(r.regulatory_aum),
        }));

    return {
      clientTypes: of('client_type'),
      services: of('service'),
      feeMethods: of('fee_method'),
      filingId: current[0]?.filing_id ?? null,
    };
  }
}
