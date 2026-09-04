import type { z } from 'zod';

import type { FilterTree, SortAst } from '@feature/entities/filter-sort/ast.js';
import type { FacetDefinition } from '@feature/prospecting/facets/facet-definitions.js';

export type SourceKind = 'advisor' | 'firm';

/** set by the http boundary from the session, never by the model */
export type ToolIdentity = { userId: string; workspaceId: string };

export type ProspectSearchInput = {
  sourceKind: SourceKind;
  filter: FilterTree | null;
  sort: SortAst;
  selectAttributeIds: string[];
  limit: number;
  offset: number;
};

export type ProspectRow = {
  sourceCrd: string;
  recordId: string | null;
  values: { attributeId: string; value: unknown }[];
};

export type ProspectSearchResult = {
  rows: ProspectRow[];
  total: number;
  limit: number;
  offset: number;
};

export type FirmLookupInput = {
  query: string;
  state: string | null;
  limit: number;
};

export type FirmCandidate = {
  firmCrd: string;
  firmName: string | null;
  city: string | null;
  state: string | null;
  regulatoryAum: string | null;
  advisorCount: number | null;
};

export type FirmFacetRow = {
  code: string;
  label: string | null;
  clientCount: number | null;
  fewerThanFive: boolean | null;
  regulatoryAum: string | null;
};

export type FacetOptionItem = { value: string; label: string };

export type EntitySummary = {
  id: string;
  slug: string;
  name: string;
  sourceKind: SourceKind | null;
};

export type ListSummary = {
  id: string;
  name: string;
  entityId: string;
  kind: 'static' | 'dynamic';
  memberCount: number;
  createdAt: string;
};

/** CRDs for a picked set; a tree for "everything the search matched" */
export type AddToListInput =
  | { listId: string; sourceCrds: string[]; filter?: undefined }
  | { listId: string; filter: FilterTree; sourceCrds?: undefined };

export type AddToListResult = {
  completed: boolean;
  recordsCreated: number;
  membersAdded: number;
  requested: number;
};

export type FirmProfile = {
  clientTypes: FirmFacetRow[];
  services: FirmFacetRow[];
  feeMethods: FirmFacetRow[];
  reportedClients: {
    min: number | null;
    max: number | null;
    quality: 'reported_number' | 'bounded_range' | 'unavailable';
  };
  filingId: string | null;
};

/**
 * The only way a tool reaches application data. apps/api implements it over the
 * query bus; libs cannot import apps, and tools must stay usable from any host.
 */
export type AssistantQueries = {
  getFacets(
    identity: ToolIdentity,
    sourceKind: SourceKind,
  ): Promise<FacetDefinition[]>;
  searchAdvisors(
    identity: ToolIdentity,
    input: ProspectSearchInput,
  ): Promise<ProspectSearchResult>;
  lookupFirm(
    identity: ToolIdentity,
    input: FirmLookupInput,
  ): Promise<FirmCandidate[]>;
  getFirmProfile(identity: ToolIdentity, firmCrd: string): Promise<FirmProfile>;
  searchFacetOptions(
    identity: ToolIdentity,
    input: { allowKey: string; query: string; limit: number },
  ): Promise<FacetOptionItem[]>;
  getEntities(identity: ToolIdentity): Promise<EntitySummary[]>;
  getLists(identity: ToolIdentity, entityId: string): Promise<ListSummary[]>;
  createList(
    identity: ToolIdentity,
    input: { entityId: string; name: string },
  ): Promise<{ id: string; name: string }>;
  addToList(
    identity: ToolIdentity,
    input: AddToListInput,
  ): Promise<AddToListResult>;
};

export type ToolContext = {
  queries: AssistantQueries;
  identity: ToolIdentity;
};

export type ToolScope = 'read' | 'write';

export type ToolDefinition<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> = {
  id: string;
  description: string;
  input: TInput;
  output: TOutput;
  scope: ToolScope;
  /** write tools pause for user confirmation in chat */
  approval: boolean;
  execute: (
    input: z.output<TInput>,
    ctx: ToolContext,
  ) => Promise<z.output<TOutput>>;
  /** a compact view for the model; the UI still receives the full output */
  toModelOutput?: (output: z.output<TOutput>) => unknown;
};

/** identity function that pins the generics so execute is typed by its schemas */
export const defineTool = <TInput extends z.ZodType, TOutput extends z.ZodType>(
  definition: ToolDefinition<TInput, TOutput>,
): ToolDefinition<TInput, TOutput> => definition;
