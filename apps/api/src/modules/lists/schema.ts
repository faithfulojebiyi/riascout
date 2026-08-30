import { z } from 'zod';

import { dateToString } from '@system/schema/utils.js';

/**
 * A cap rather than a job queue. The add is two set-based statements whatever
 * the size, so this bounds request time rather than round trips — the legacy
 * defect was one request per advisor, which this cannot reproduce.
 */
export const BULK_ADD_MAX = 5000;

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
    /** records newly brought into the CRM by this add */
    recordsCreated: z.number().int(),
    /** memberships added; lower than requested when some were already members */
    membersAdded: z.number().int(),
    requested: z.number().int(),
  })
  .meta({ id: 'AddToListResponse' });
