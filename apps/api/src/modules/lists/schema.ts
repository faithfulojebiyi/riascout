import { z } from 'zod';

import { dateToString } from '@system/schema/utils.js';

/** beyond this the add is queued, so a large save never holds a request open */
export const SYNC_ADD_MAX = 1000;

/** the outer bound on one request either way */
export const BULK_ADD_MAX = 50000;

export const GetListsSchema = z
  .object({ entityId: z.uuid().nullable().default(null) })
  .meta({ id: 'GetLists' });

const ListSummarySchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    entityId: z.uuid(),
    kind: z.enum(['static', 'dynamic']),
    visibility: z.string(),
    memberCount: z.number().int(),
    createdAt: dateToString,
  })
  .meta({ id: 'ListSummary' });

export const GetListsResponseSchema = z
  .object({ lists: z.array(ListSummarySchema) })
  .meta({ id: 'GetListsResponse' });

export const CreateListSchema = z
  .object({
    entityId: z.uuid(),
    name: z.string().min(1).max(120),
    visibility: z.enum(['workspace', 'private']).default('workspace'),
  })
  .meta({ id: 'CreateList' });

export const CreateListResponseSchema = z
  .object({ id: z.uuid(), name: z.string() })
  .meta({ id: 'CreateListResponse' });

export const AddToListSchema = z
  .object({
    listId: z.uuid(),
    /** market CRDs; the records are created if they do not exist yet */
    sourceCrds: z.array(z.string().regex(/^\d+$/)).min(1).max(BULK_ADD_MAX),
  })
  .meta({ id: 'AddToList' });

export const AddToListResponseSchema = z
  .object({
    /** false when the add was queued, in which case the counts are not yet known */
    completed: z.boolean(),
    /** records newly brought into the CRM by this add */
    recordsCreated: z.number().int(),
    /** memberships added; lower than requested when some were already members */
    membersAdded: z.number().int(),
    requested: z.number().int(),
  })
  .meta({ id: 'AddToListResponse' });
