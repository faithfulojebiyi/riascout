import type { InngestFunction } from 'inngest';

import type { AppPrismaService } from '@system/database/database.service.js';

import { bulkAddToList } from './bulk-add-to-list.function.js';
import { failedEvents } from './failed-events.function.js';

/** the worker consumes; every function is registered here or it never runs */
export const getInngestRegistry = ({
  appPrismaService,
}: {
  appPrismaService: AppPrismaService;
}): InngestFunction.Any[] => [
  bulkAddToList({ appPrismaService }),
  failedEvents(),
];
