import { z } from 'zod';

import { filterTreeSchema, sortAstSchema } from '@feature/entities/filter-sort/ast.js';

/**
 * The filter tree is parsed here, at the boundary, so the compiler only ever
 * sees a shape it can walk. A malformed tree is a 400, not a dropped condition.
 */
export const GetEntityRecordsSchema = z
  .object({
    entityId: z.uuid(),
    filter: filterTreeSchema.nullable().default(null),
    sort: sortAstSchema.default([]),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().min(0).default(0),
  })
  .meta({ id: 'GetEntityRecords' });

const CellSchema = z
  .object({
    attributeId: z.uuid(),
    value: z.unknown(),
    /** null means a human authored it; a source means a machine did */
    source: z.string().nullable(),
    version: z.number().int(),
  })
  .meta({ id: 'EntityRecordCell' });

const EdgeSchema = z
  .object({
    attributeId: z.uuid(),
    targetIds: z.array(z.uuid()),
  })
  .meta({ id: 'EntityRecordEdge' });

const RecordSchema = z
  .object({
    id: z.uuid(),
    /** the market CRD this record points at, when it is a reference record */
    sourceCrd: z.string().nullable(),
    cells: z.array(CellSchema),
    edges: z.array(EdgeSchema),
  })
  .meta({ id: 'EntityRecordRow' });

export const GetEntityRecordsResponseSchema = z
  .object({
    records: z.array(RecordSchema),
    /** total matching the filter, not the page — the grid needs the denominator */
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })
  .meta({ id: 'GetEntityRecordsResponse' });

/**
 * A cell write carries expectedVersion so a stale edit is a 409 rather than a
 * silent last-write-wins. Omit it to force the write.
 */
const CellWriteSchema = z.object({
  attributeId: z.uuid(),
  value: z.unknown(),
  expectedVersion: z.number().int().min(0).optional(),
});

export const UpdateRecordValuesSchema = z
  .object({
    recordId: z.uuid(),
    values: z.array(CellWriteSchema).min(1).max(100),
  })
  .meta({ id: 'UpdateRecordValues' });

export const UpdateRecordValuesResponseSchema = z
  .object({
    results: z.array(
      z.object({
        attributeId: z.uuid(),
        status: z.enum(['written', 'skipped', 'conflict']),
        version: z.number().int().nullable(),
      }),
    ),
  })
  .meta({ id: 'UpdateRecordValuesResponse' });

export const CreateEntityRecordSchema = z
  .object({
    entityId: z.uuid(),
    /** points at market by CRD, never at a firm an advisor works for */
    sourceKind: z.enum(['advisor', 'firm']).nullable().default(null),
    sourceCrd: z.string().regex(/^\d+$/).nullable().default(null),
    values: z.array(CellWriteSchema).max(100).default([]),
  })
  .meta({ id: 'CreateEntityRecord' });

export const CreateEntityRecordResponseSchema = z
  .object({
    id: z.uuid(),
    /** false when the record already existed for this CRD */
    created: z.boolean(),
  })
  .meta({ id: 'CreateEntityRecordResponse' });
