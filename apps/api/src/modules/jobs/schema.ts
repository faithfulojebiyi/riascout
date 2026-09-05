import { z } from 'zod';

import { dateToString } from '@system/schema/utils.js';

export const GetJobSchema = z
  .object({ jobId: z.uuid() })
  .meta({ id: 'GetJob' });

export const GetJobResponseSchema = z
  .object({
    id: z.uuid(),
    /** the event key that started it, e.g. lists/bulk.add */
    kind: z.string(),
    status: z.enum(['queued', 'running', 'completed', 'failed']),
    /** what the job acts on; a record schema would emit propertyNames, which orval rejects */
    payload: z.object({
      listId: z.string().optional(),
      entityId: z.string().optional(),
      sourceKind: z.string().optional(),
    }),
    /** 0 while a filter save is still resolving its population */
    requested: z.number().int(),
    processed: z.number().int(),
    created: z.number().int(),
    added: z.number().int(),
    error: z.string().nullable(),
    createdAt: dateToString,
    startedAt: dateToString.nullable(),
    finishedAt: dateToString.nullable(),
  })
  .meta({ id: 'GetJobResponse' });
