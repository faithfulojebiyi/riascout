import { z } from 'zod';

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
    values: z.record(z.string(), z.unknown()),
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
