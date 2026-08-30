import type { InngestFunction } from 'inngest';

import { bulkAddToList } from '../lists/queues/bulk-add-to-list.js';
import type { InngestFunctionDto } from './event-publisher.dto.js';
import { failedEvents } from './failed-events.function.js';

/**
 * Feature consumers live beside the commands they dispatch, in each module's
 * queues folder; only cross-cutting functions stay here. Every one is
 * registered below or it never runs.
 */
export const getInngestRegistry = (
  deps: InngestFunctionDto,
): InngestFunction.Any[] => [bulkAddToList(deps), failedEvents()];
