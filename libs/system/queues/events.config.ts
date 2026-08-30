import { eventType } from 'inngest';

import { bulkAddToListSchema } from './dto/lists.dto.js';

export const EVENT_KEYS = {
  LIST_BULK_ADD: 'lists/bulk.add',

  // inngest's built-in event, fired when a function exhausts its retries
  FAILED_EVENT: 'inngest/function.failed',
} as const;

export const INNGEST_OPTIONS = {
  retries: 1 as const,
};

/**
 * Pairs each key with its zod schema, so createFunction triggers and sendEvent
 * stay type-safe. Add an entry per event and the types flow to both ends.
 */
export const EVENTS = {
  LIST_BULK_ADD: eventType(EVENT_KEYS.LIST_BULK_ADD, {
    schema: bulkAddToListSchema,
  }),
};
