import { z } from 'zod';

import {
  filterTreeSchema,
  sortAstSchema,
  sortDirectionSchema,
} from '@feature/entities/filter-sort/ast.js';

/**
 * The filter tree is parsed here, at the boundary, so the compiler only ever
 * sees a shape it can walk. A malformed tree is a 400, not a dropped condition.
 */
export const GetEntityRecordsSchema = z
  .object({
    entityId: z.uuid(),
    /** omit to use the entity's default view */
    viewId: z.uuid().nullable().default(null),
    /** narrow to the columns actually on screen; omit for every visible one */
    visibleFieldIds: z.array(z.uuid()).max(200).default([]),
    /** overrides the view's saved filter; omit to use the view's */
    filter: filterTreeSchema.nullable().default(null),
    /** overrides the view's saved sort when non-empty */
    sort: sortAstSchema.default([]),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().min(0).default(0),
  })
  .meta({ id: 'GetEntityRecords' });

const ChoiceSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    color: z.string().nullable(),
  })
  .meta({ id: 'EntityAttributeChoice' });

/** what the grid needs to render its columns */
const ViewFieldSchema = z
  .object({
    fieldId: z.uuid(),
    attributeId: z.uuid(),
    label: z.string(),
    icon: z.string().nullable(),
    type: z.string(),
    group: z.string().nullable(),
    position: z.string(),
    isVisible: z.boolean(),
    isPinned: z.boolean(),
    width: z.number().int().nullable(),
    /** excluded from the page query; the cell renderer fetches it on demand */
    lazy: z.boolean(),
    /** projected from market; the client renders it read-only */
    isEditable: z.boolean(),
    /** empty unless the type is status or select; the editor has no other source */
    choices: z.array(ChoiceSchema),
  })
  .meta({ id: 'EntityViewField' });

const ViewSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    isDefault: z.boolean(),
    /** the column header needs it to mark which column is sorted, and which way */
    sort: sortAstSchema,
    /** every attribute has a field row, so hiding one is a flag, not a delete */
    fields: z.array(ViewFieldSchema),
  })
  .meta({ id: 'EntityViewSummary' });

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
    view: ViewSchema.nullable(),
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

/**
 * Everything the column header menu can change. Every field is optional so one
 * menu item sends one key rather than the client echoing back the whole column.
 */
export const UpdateViewFieldSchema = z
  .object({
    viewId: z.uuid(),
    fieldId: z.uuid(),
    label: z.string().trim().min(1).max(120).optional(),
    isVisible: z.boolean().optional(),
    isPinned: z.boolean().optional(),
    width: z.number().int().min(60).max(1200).optional(),
  })
  .meta({ id: 'UpdateViewField' });

export const MoveViewFieldSchema = z
  .object({
    viewId: z.uuid(),
    fieldId: z.uuid(),
    /** one step, from the column header menu */
    direction: z.enum(['left', 'right']).optional(),
    /** an absolute slot, from dragging the column list in view settings */
    toIndex: z.number().int().min(0).max(500).optional(),
  })
  // exactly one of the two, never both and never neither
  .refine(
    (value) =>
      (value.direction === undefined) !== (value.toIndex === undefined),
    { message: 'Provide exactly one of direction or toIndex' },
  )
  .meta({ id: 'MoveViewField' });

export const MoveViewFieldResponseSchema = z
  .object({ position: z.string() })
  .meta({ id: 'MoveViewFieldResponse' });

/** null clears the sort back to the view's natural order */
export const UpdateViewSortSchema = z
  .object({
    viewId: z.uuid(),
    attributeId: z.uuid(),
    direction: sortDirectionSchema.nullable(),
  })
  .meta({ id: 'UpdateViewSort' });

/** the sidebar needs to know what exists before it can navigate anywhere */
export const GetEntitiesSchema = z.object({}).meta({ id: 'GetEntities' });

const EntitySummarySchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    /** which market projection this entity points at, if any */
    sourceKind: z.enum(['advisor', 'firm']).nullable(),
    recordCount: z.number().int(),
    attributeCount: z.number().int(),
    views: z.array(
      z.object({ id: z.uuid(), name: z.string(), isDefault: z.boolean() }),
    ),
  })
  .meta({ id: 'EntitySummary' });

export const GetEntitiesResponseSchema = z
  .object({ entities: z.array(EntitySummarySchema) })
  .meta({ id: 'GetEntitiesResponse' });
