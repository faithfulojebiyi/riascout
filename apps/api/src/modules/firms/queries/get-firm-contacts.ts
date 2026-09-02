import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import type { Prisma } from '@orm/app';
import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import { toCount } from '../decimal.js';

import type {
  GetFirmContactsDto,
  GetFirmContactsResponseDto,
} from '../dto/firms.dto.js';

export class GetFirmContactsQuery extends Query<GetFirmContactsResponseDto> {
  constructor(public readonly dto: GetFirmContactsDto) {
    super();
  }
}

/**
 * A closed map, never a raw column name from the request. advisorCrd is appended
 * to every one of them so a page boundary cannot duplicate or skip a row when
 * the leading key ties.
 */
const SORTS: Record<
  GetFirmContactsDto['sortBy'],
  (d: 'asc' | 'desc') => Prisma.AdvisorSearchOrderByWithRelationInput[]
> = {
  name: (d) => [{ fullName: d }, { advisorCrd: 'asc' }],
  tenure: (d) => [{ tenureMonths: d }, { advisorCrd: 'asc' }],
  experience: (d) => [{ experienceMonths: d }, { advisorCrd: 'asc' }],
  state: (d) => [{ state: d }, { advisorCrd: 'asc' }],
  disclosure: (d) => [{ disclosureCount: d }, { advisorCrd: 'asc' }],
};

/**
 * Named explicitly rather than taking the whole row: the projection carries 60+
 * columns for a tab that shows 16, and selecting all of them also drags in
 * firm_custodian_ids, an int[] the ETL can leave holding a null element.
 */
const CONTACT_COLUMNS = {
  advisorCrd: true,
  fullName: true,
  city: true,
  state: true,
  currentFirmSince: true,
  currentFirmSource: true,
  currentFirmObservedOn: true,
  tenureYears: true,
  experienceYears: true,
  currentFirmCount: true,
  designations: true,
  disclosureStatus: true,
  disclosureCount: true,
  ownsCurrentFirm: true,
  ownerTitle: true,
} as const;

@QueryHandler(GetFirmContactsQuery)
export class GetFirmContactsQueryHandler
  implements IQueryHandler<GetFirmContactsQuery>
{
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute({
    dto,
  }: GetFirmContactsQuery): Promise<GetFirmContactsResponseDto> {
    const where = { currentFirmCrd: dto.firmCrd };

    /**
     * Reads the projection rather than advisor_current_affiliation: the view
     * join measures 875ms+ on a 29,020-adviser firm because the planner has to
     * scan all 510,725 projection rows to satisfy the name sort.
     *
     * The cost is real and reported rather than hidden — see affiliationTotal.
     */
    const [contacts, total, affiliationTotal] = await Promise.all([
      this.appPrismaService.advisorSearch.findMany({
        where,
        select: CONTACT_COLUMNS,
        orderBy: SORTS[dto.sortBy](dto.direction),
        take: dto.limit,
        skip: dto.offset,
      }),
      this.appPrismaService.advisorSearch.count({ where }),
      this.appPrismaService.firmSearch
        .findUnique({
          where: { firmCrd: dto.firmCrd },
          select: { observedAdvisorCount: true },
        })
        .then((f) => f?.observedAdvisorCount ?? null),
    ]);

    const recordIdByCrd = await this.readRecordIds(
      contacts.map((c) => c.advisorCrd),
    );

    return {
      contacts: contacts.map((c) => ({
        advisorCrd: String(c.advisorCrd),
        fullName: c.fullName,
        city: c.city,
        state: c.state,
        currentFirmSince: c.currentFirmSince?.toISOString() ?? null,
        currentFirmSource: c.currentFirmSource,
        currentFirmObservedOn: c.currentFirmObservedOn?.toISOString() ?? null,
        tenureYears: toCount(c.tenureYears),
        experienceYears: toCount(c.experienceYears),
        currentFirmCount: toCount(c.currentFirmCount),
        designations: c.designations,
        disclosureStatus: c.disclosureStatus,
        disclosureCount: toCount(c.disclosureCount),
        ownsCurrentFirm: c.ownsCurrentFirm,
        ownerTitle: c.ownerTitle,
        recordId: recordIdByCrd.get(String(c.advisorCrd)) ?? null,
      })),
      total,
      affiliationTotal,
      limit: dto.limit,
      offset: dto.offset,
    };
  }

  /**
   * Which of this page is already in the workspace, so each row can offer
   * "open" rather than "add". Empty without a workspace — market is global, so
   * the roster itself still reads.
   */
  private async readRecordIds(
    crds: bigint[],
  ): Promise<Map<string, string>> {
    const workspaceId = this.alsService.ctx.get('workspaceId');

    if (!workspaceId || crds.length === 0) {
      return new Map();
    }

    const records = await this.appPrismaService.entityRecord.findMany({
      where: { workspaceId, sourceKind: 'advisor', sourceCrd: { in: crds } },
      select: { id: true, sourceCrd: true },
    });

    return new Map(
      records.flatMap((r) =>
        r.sourceCrd === null ? [] : [[String(r.sourceCrd), r.id] as const],
      ),
    );
  }
}
