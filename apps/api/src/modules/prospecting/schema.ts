import { z } from 'zod';

import { AttributeType } from '@orm/app';

import {
  filterTreeSchema,
  sortAstSchema,
} from '@feature/entities/filter-sort/ast.js';

/**
 * The same FilterTree the grid sends. Prospecting and the grid share one filter
 * language and one compiler, so an operator cannot mean two things.
 */
export const SearchAdvisorsSchema = z
  .object({
    sourceKind: z.enum(['advisor', 'firm']).default('advisor'),
    filter: filterTreeSchema.nullable().default(null),
    sort: sortAstSchema.default([]),
    /** reference attributes to return; the rail decides which columns show */
    selectAttributeIds: z.array(z.uuid()).max(60).default([]),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().min(0).max(10000).default(0),
  })
  .meta({ id: 'SearchAdvisors' });

const ProspectRowSchema = z
  .object({
    /** market CRD, as a string: bigint has no JSON representation */
    sourceCrd: z.string(),
    /** set when this prospect is already saved in the workspace */
    recordId: z.uuid().nullable(),
    /** an array, not a map: OpenAPI 3.0 has no propertyNames, and this
     *  matches the shape entity records already return */
    values: z.array(z.object({ attributeId: z.uuid(), value: z.unknown() })),
  })
  .meta({ id: 'ProspectRow' });

export const SearchAdvisorsResponseSchema = z
  .object({
    rows: z.array(ProspectRowSchema),
    /** total matching the filter, not the page — the rail needs the denominator */
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })
  .meta({ id: 'SearchAdvisorsResponse' });

export const GetFacetsSchema = z
  .object({ sourceKind: z.enum(['advisor', 'firm']).default('advisor') })
  .meta({ id: 'GetFacets' });

export const FacetOptionSchema = z
  .object({ value: z.string(), label: z.string() })
  .meta({ id: 'FacetOption' });

const FacetDefinitionSchema = z
  .object({
    attributeId: z.uuid(),
    /** stable identity; label is display text a user may rename */
    allowKey: z.string(),
    label: z.string(),
    icon: z.string().nullable(),
    group: z.string(),
    kind: z.enum(['multiSelect', 'search', 'number', 'boolean', 'date']),
    /** kind drives the filter control; type drives the cell renderer */
    type: z.enum(AttributeType),
    operators: z.array(z.string()),
    isArray: z.boolean(),
    /** empty for search facets, which fetch options on demand */
    options: z.array(FacetOptionSchema),
  })
  .meta({ id: 'FacetDefinition' });

export const GetFacetsResponseSchema = z
  .object({ facets: z.array(FacetDefinitionSchema) })
  .meta({ id: 'GetFacetsResponse' });

export const SearchFacetOptionsSchema = z
  .object({
    /** allowlist key, validated against the registry before it reaches SQL */
    allowKey: z.string().min(1).max(120),
    query: z.string().max(120).default(''),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .meta({ id: 'SearchFacetOptions' });

export const SearchFacetOptionsResponseSchema = z
  .object({ options: z.array(FacetOptionSchema) })
  .meta({ id: 'SearchFacetOptionsResponse' });
