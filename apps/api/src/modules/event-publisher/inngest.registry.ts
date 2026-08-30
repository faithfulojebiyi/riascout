import type { InngestFunction } from 'inngest';

import { failedEvents } from './failed-events.function.js';

/**
 * The api publishes events and serves the endpoint, but consumes almost
 * nothing — the work belongs on the worker, which is not request-scoped.
 */
export const getInngestRegistry = (): InngestFunction.Any[] => [failedEvents()];
