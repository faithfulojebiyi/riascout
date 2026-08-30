import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { withUser } from './events.dto.js';

/**
 * CRDs rather than record ids: the records may not exist yet, since saving to a
 * list is also what brings an advisor into the CRM.
 */
export const bulkAddToListSchema = withUser({
  listId: z.uuid(),
  entityId: z.uuid(),
  sourceKind: z.enum(['advisor', 'firm']),
  sourceCrds: z.array(z.string().regex(/^\d+$/)).min(1),
}).meta({ id: 'BulkAddToList' });

export class BulkAddToListDto extends createZodDto(bulkAddToListSchema) {}
