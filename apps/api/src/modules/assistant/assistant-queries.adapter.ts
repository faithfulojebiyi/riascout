import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { lookupFirm } from '@orm/app/sql/lookupFirm.js';
import type {
  AddToListInput,
  AddToListResult,
  AssistantQueries,
  EntitySummary,
  FirmCandidate,
  FirmLookupInput,
  FacetOptionItem,
  FirmProfile,
  ListSummary,
  ProspectSearchInput,
  ProspectSearchResult,
  RecordSnapshot,
  RecordWrite,
  RecordWriteResult,
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

import { CreateEntityRecordCommand } from '../entities/commands/create-entity-record.js';
import { UpdateRecordValuesCommand } from '../entities/commands/update-record-values.js';
import { GetEntitiesQuery } from '../entities/queries/get-entities.js';
import { GetEntityRecordQuery } from '../entities/queries/get-entity-record.js';
import { GetFirmProfileQuery } from '../firms/queries/get-firm-profile.js';
import { AddToListCommand } from '../lists/commands/add-to-list.js';
import { CreateListCommand } from '../lists/commands/create-list.js';
import { GetListsQuery } from '../lists/queries/get-lists.js';
import { GetFacetsQuery } from '../prospecting/queries/get-facets.js';
import { SearchFacetOptionsQuery } from '../prospecting/queries/search-facet-options.js';
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
    private readonly commandBus: CommandBus,
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

  async searchFacetOptions(
    _identity: ToolIdentity,
    input: { allowKey: string; query: string; limit: number },
  ): Promise<FacetOptionItem[]> {
    // option values are global market vocabulary; no workspace scope involved
    const { options } = await this.queryBus.execute(
      new SearchFacetOptionsQuery(input),
    );

    return options;
  }

  getEntities(identity: ToolIdentity): Promise<EntitySummary[]> {
    return this.inScope(identity, async () => {
      const { entities } = await this.queryBus.execute(
        new GetEntitiesQuery({}),
      );

      return entities.map(({ id, slug, name, sourceKind }) => ({
        id,
        slug,
        name,
        sourceKind,
      }));
    });
  }

  getLists(identity: ToolIdentity, entityId: string): Promise<ListSummary[]> {
    return this.inScope(identity, async () => {
      const { lists } = await this.queryBus.execute(
        new GetListsQuery({ entityId }),
      );

      return lists;
    });
  }

  createList(
    identity: ToolIdentity,
    input: { entityId: string; name: string },
  ): Promise<{ id: string; name: string }> {
    return this.inScope(identity, () =>
      this.commandBus.execute(
        new CreateListCommand({ ...input, visibility: 'workspace' }),
      ),
    );
  }

  addToList(
    identity: ToolIdentity,
    input: AddToListInput,
  ): Promise<AddToListResult> {
    return this.inScope(identity, () =>
      this.commandBus.execute(
        new AddToListCommand(
          input.sourceCrds
            ? { listId: input.listId, sourceCrds: input.sourceCrds }
            : { listId: input.listId, filter: input.filter },
        ),
      ),
    );
  }

  async findRecordId(
    identity: ToolIdentity,
    input: { entityId: string; sourceKind: SourceKind; sourceCrd: string },
  ): Promise<string | null> {
    // a read must not create a record; the command path is idempotent but writes
    const record = await this.appPrismaService.entityRecord.findFirst({
      where: {
        workspaceId: identity.workspaceId,
        entityId: input.entityId,
        sourceKind: input.sourceKind,
        sourceCrd: BigInt(input.sourceCrd),
      },
      select: { id: true },
    });

    return record?.id ?? null;
  }

  ensureRecord(
    identity: ToolIdentity,
    input: { entityId: string; sourceKind: SourceKind; sourceCrd: string },
  ): Promise<{ id: string; created: boolean }> {
    return this.inScope(identity, () =>
      this.commandBus.execute(
        new CreateEntityRecordCommand({ ...input, values: [] }),
      ),
    );
  }

  getRecord(identity: ToolIdentity, recordId: string): Promise<RecordSnapshot> {
    return this.inScope(identity, async () => {
      const record = await this.queryBus.execute(
        new GetEntityRecordQuery({ recordId }),
      );

      return {
        recordId: record.recordId,
        entitySlug: record.entitySlug,
        attributes: record.attributes
          .filter((a) => a.referenceColumn === null && a.isEditable)
          .map((a) => ({
            id: a.attributeId,
            key: a.key,
            label: a.label,
            type: a.type,
            isMultiValue: a.isMultiValue,
            choices: a.choices.map((choice) => choice.name),
          })),
        cells: record.cells.map(({ attributeId, value, version }) => ({
          attributeId,
          value,
          version,
        })),
        lists: record.lists.map((list) => list.name),
      };
    });
  }

  updateRecordValues(
    identity: ToolIdentity,
    input: { recordId: string; values: RecordWrite[] },
  ): Promise<RecordWriteResult> {
    return this.inScope(identity, () =>
      this.commandBus.execute(new UpdateRecordValuesCommand(input)),
    );
  }
}
