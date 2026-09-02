import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import type {
  GetAdvisorProfileDto,
  GetAdvisorProfileResponseDto,
} from '../dto/advisors.dto.js';

export class GetAdvisorProfileQuery extends Query<GetAdvisorProfileResponseDto> {
  constructor(public readonly dto: GetAdvisorProfileDto) {
    super();
  }
}

/**
 * The nine documented flags. has_other exists in the source but is not one of
 * them, so it is excluded from both the list and the count — the same rule the
 * advisor projection applies.
 */
const DISCLOSURE_FLAGS = [
  ['hasRegulatoryAction', 'Regulatory action'],
  ['hasCriminal', 'Criminal'],
  ['hasBankruptcy', 'Bankruptcy'],
  ['hasCivilJudgment', 'Civil judgment'],
  ['hasBond', 'Bond'],
  ['hasJudgment', 'Judgment'],
  ['hasInvestigation', 'Investigation'],
  ['hasCustomerComplaint', 'Customer complaint'],
  ['hasTermination', 'Termination'],
] as const;

type Registration = {
  employerFirmCrd: bigint;
  sourceEmployerName: string | null;
  jurisdiction: string | null;
  intervalSource: string | null;
  startDate: Date | null;
  endDate: Date | null;
};

const day = (value: Date | null): string | null =>
  value === null ? null : value.toISOString();

@QueryHandler(GetAdvisorProfileQuery)
export class GetAdvisorProfileQueryHandler
  implements IQueryHandler<GetAdvisorProfileQuery>
{
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute({
    dto,
  }: GetAdvisorProfileQuery): Promise<GetAdvisorProfileResponseDto> {
    const where = { advisorCrd: dto.advisorCrd };

    /**
     * Read whole and folded here rather than aggregated in SQL. The worst
     * adviser in the table has 100 registration rows and 92 employment rows, so
     * the round trip is cheaper than the group-by would be to express.
     */
    const [registrations, employment, exams, designations, disclosure, derived] =
      await Promise.all([
        this.appPrismaService.advisorRegistration.findMany({
          where,
          select: {
            employerFirmCrd: true,
            sourceEmployerName: true,
            jurisdiction: true,
            intervalSource: true,
            startDate: true,
            endDate: true,
          },
        }),
        this.appPrismaService.advisorEmployment.findMany({
          where,
          orderBy: [{ startMonth: 'desc' }, { employmentSequence: 'asc' }],
        }),
        this.appPrismaService.advisorExam.findMany({
          where,
          orderBy: { examDate: 'asc' },
        }),
        this.appPrismaService.advisorDesignation.findMany({ where }),
        this.appPrismaService.advisorDisclosureFlag.findUnique({
          where: { advisorCrd: dto.advisorCrd },
        }),
        this.appPrismaService.advisorDerived.findUnique({
          where: { advisorCrd: dto.advisorCrd },
        }),
      ]);

    const stints = this.foldStints(registrations);
    const recordIdByCrd = await this.readRecordIds(
      stints.map((stint) => BigInt(stint.firmCrd)),
    );

    return {
      stints: stints.map((stint) => ({
        ...stint,
        recordId: recordIdByCrd.get(stint.firmCrd) ?? null,
      })),
      employment: employment.map((row) => ({
        employerName: row.sourceEmployerName,
        city: row.city,
        region: row.regionRaw,
        startMonth: day(row.startMonth),
        endMonth: day(row.endMonth),
        isOpenEnded: row.isOpenEnded,
      })),
      exams: exams.map((exam) => ({
        code: exam.examCode,
        takenOn: day(exam.examDate),
      })),
      designations: designations.map((row) => row.designationName),
      jurisdictions: [
        ...new Set(
          registrations
            .map((row) => row.jurisdiction)
            .filter((value): value is string => value !== null),
        ),
      ].sort(),
      disclosures: this.foldDisclosures(disclosure),
      experienceMonths: derived?.experienceMonths ?? null,
      tenureMonths: derived?.tenureMonths ?? null,
    };
  }

  /**
   * Registrations sit at jurisdiction grain, so one stint is many rows. Keyed by
   * firm *and* interval source: 25,056 advisers hold both a current and a
   * previous registration at the same firm, and folding on the firm alone would
   * report a single continuous tenure that never happened.
   */
  private foldStints(registrations: Registration[]) {
    const byStint = new Map<
      string,
      {
        firmCrd: string;
        firmName: string | null;
        startedOn: string | null;
        endedOn: string | null;
        isCurrent: boolean;
        jurisdictionCount: number;
        jurisdictions: string[];
      }
    >();

    for (const row of registrations) {
      const firmCrd = String(row.employerFirmCrd);
      const key = `${firmCrd}:${row.intervalSource ?? 'unknown'}`;
      const existing = byStint.get(key);

      // still open in any jurisdiction means the stint is open
      const open = row.endDate === null;
      const started = row.startDate;
      const ended = row.endDate;

      if (!existing) {
        byStint.set(key, {
          firmCrd,
          firmName: row.sourceEmployerName,
          startedOn: day(started),
          endedOn: open ? null : day(ended),
          isCurrent: open,
          jurisdictionCount: row.jurisdiction === null ? 0 : 1,
          jurisdictions: row.jurisdiction === null ? [] : [row.jurisdiction],
        });
        continue;
      }

      if (started && (!existing.startedOn || day(started)! < existing.startedOn)) {
        existing.startedOn = day(started);
      }

      if (open) {
        existing.isCurrent = true;
        existing.endedOn = null;
      } else if (!existing.isCurrent && ended) {
        const candidate = day(ended)!;

        if (!existing.endedOn || candidate > existing.endedOn) {
          existing.endedOn = candidate;
        }
      }

      existing.firmName ??= row.sourceEmployerName;

      if (row.jurisdiction !== null && !existing.jurisdictions.includes(row.jurisdiction)) {
        existing.jurisdictions.push(row.jurisdiction);
        existing.jurisdictionCount = existing.jurisdictions.length;
      }
    }

    return [...byStint.values()]
      .map((stint) => ({ ...stint, jurisdictions: stint.jurisdictions.sort() }))
      // current first, then most recent start; a null start sorts last
      .sort((a, b) => {
        if (a.isCurrent !== b.isCurrent) {
          return a.isCurrent ? -1 : 1;
        }

        return (b.startedOn ?? '').localeCompare(a.startedOn ?? '');
      });
  }

  /** null anywhere means unknown, which is not a clean record */
  private foldDisclosures(
    flags: Record<string, unknown> | null,
  ): GetAdvisorProfileResponseDto['disclosures'] {
    if (!flags) {
      return { anyReported: null, reported: [], count: null };
    }

    const reported = DISCLOSURE_FLAGS.filter(
      ([key]) => flags[key] === true,
    ).map(([, label]) => label);

    const unknown = DISCLOSURE_FLAGS.some(
      ([key]) => flags[key] === null || flags[key] === undefined,
    );

    return {
      anyReported: unknown ? null : reported.length > 0,
      reported,
      count: unknown ? null : reported.length,
    };
  }

  /** which of these firms is already in the workspace, so a stint can link */
  private async readRecordIds(crds: bigint[]): Promise<Map<string, string>> {
    const workspaceId = this.alsService.ctx.get('workspaceId');

    if (!workspaceId || crds.length === 0) {
      return new Map();
    }

    const records = await this.appPrismaService.entityRecord.findMany({
      where: { workspaceId, sourceKind: 'firm', sourceCrd: { in: crds } },
      select: { id: true, sourceCrd: true },
    });

    return new Map(
      records.flatMap((record) =>
        record.sourceCrd === null
          ? []
          : [[String(record.sourceCrd), record.id] as const],
      ),
    );
  }
}
