import type { InngestFunction } from 'inngest';

import { bulkAddToList } from './bulk-add-to-list.function.js';
import type { InngestFunctionDto } from './event-publisher.dto.js';
import { failedEvents } from './failed-events.function.js';

/** the worker consumes; every function is registered here or it never runs */
export const getInngestRegistry = (
  deps: InngestFunctionDto,
): InngestFunction.Any[] => [bulkAddToList(deps), failedEvents()];
