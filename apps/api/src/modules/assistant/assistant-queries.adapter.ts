import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';

import { lookupFirm } from '@orm/app/sql/lookupFirm.js';
import type {
  AssistantQueries,
  FirmCandidate,
  FirmLookupInput,
  FirmProfile,
  ProspectSearchInput,
  ProspectSearchResult,
  SourceKind,
  ToolIdentity,
} from '@feature/assistant/tools/define-tool.js';
import {
  filterOperatorSchema,
  type FilterOperator,
} from '@feature/entities/filter-sort/ast.js';
import type { FacetDefinition } from '@feature/prospecting/facets/facet-definitions.js';
import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import { GetFirmProfileQuery } from '../firms/queries/get-firm-profile.js';
import { GetFacetsQuery } from '../prospecting/queries/get-facets.js';
import { SearchAdvisorsQuery } from '../prospecting/queries/search-advisors.js';

const isFilterOperator = (value: string): value is FilterOperator =>
  filterOperatorSchema.safeParse(value).success;

/**
 * The tools' only door into application data. Mastra's routes bypass Nest's
 * CLS middleware, so every dispatch opens a CLS scope carrying the identity
 * the mount hook verified; the handlers then read ALS exactly as they do for
 * Nest routes.
 */
@Injectable()
export class AssistantQueriesAdapter implements AssistantQueries {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly als: AlsService,
    private readonly appPrismaService: AppPrismaService,
  ) {}

  private inScope<T>(
    identity: ToolIdentity,
    work: () => Promise<T>,
  ): Promise<T> {
    return this.als.ctx.runWith(
      {
        requestId: randomUUID(),
        userId: identity.userId,
        workspaceId: identity.workspaceId,
      },
      work,
    );
  }

  getFacets(
    identity: ToolIdentity,
    sourceKind: SourceKind,
  ): Promise<FacetDefinition[]> {
    return this.inScope(identity, async () => {
      const { facets } = await this.queryBus.execute(
        new GetFacetsQuery({ sourceKind }),
      );

      // the response dto widens operators to string[]; the tools need the enum
      return facets.map((facet) => ({
        ...facet,
        operators: facet.operators.filter(isFilterOperator),
      }));
    });
  }

  searchAdvisors(
    identity: ToolIdentity,
    input: ProspectSearchInput,
  ): Promise<ProspectSearchResult> {
    return this.inScope(identity, () =>
      this.queryBus.execute(new SearchAdvisorsQuery(input)),
    );
  }

  async lookupFirm(
    _identity: ToolIdentity,
    input: FirmLookupInput,
  ): Promise<FirmCandidate[]> {
    // market data is global; no workspace scope is involved
    const rows = await this.appPrismaService.$queryRawTyped(
      lookupFirm(input.query, input.state ?? '', input.limit),
    );

    return rows.map((row) => ({
      firmCrd: String(row.firm_crd),
      firmName: row.firm_name,
      city: row.city,
      state: row.state,
      regulatoryAum:
        row.regulatory_aum === null ? null : row.regulatory_aum.toString(),
      advisorCount: row.advisor_count,
    }));
  }

  getFirmProfile(
    _identity: ToolIdentity,
    firmCrd: string,
  ): Promise<FirmProfile> {
    return this.queryBus.execute(
      new GetFirmProfileQuery({ firmCrd: BigInt(firmCrd) }),
    );
  }
}
