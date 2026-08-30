import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { withUser } from './events.dto.js';

/**
 * Either an explicit set of CRDs, or the filter that selects them. Saving a
 * whole filtered search would otherwise mean shipping tens of thousands of ids
 * through the event, so the worker resolves the filter instead.
 *
 * The filter stays opaque here: system is the lower layer and must not depend
 * on a feature's AST. The worker parses it with filterTreeSchema.
 */
export const bulkAddToListSchema = withUser({
  listId: z.uuid(),
  entityId: z.uuid(),
  sourceKind: z.enum(['advisor', 'firm']),
  sourceCrds: z.array(z.string().regex(/^\d+$/)).optional(),
  filter: z.unknown().optional(),
})
  // exactly one of the two, never both and never neither
  .refine(
    (value) =>
      Boolean(value.sourceCrds?.length) !== (value.filter !== undefined),
    { message: 'provide either sourceCrds or filter, not both' },
  )
  .meta({ id: 'BulkAddToList' });

export class BulkAddToListDto extends createZodDto(bulkAddToListSchema) {}
