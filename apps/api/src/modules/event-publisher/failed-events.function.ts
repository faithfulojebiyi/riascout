import { Logger } from '@nestjs/common';

import type { InngestFunction } from 'inngest';

import { EVENT_KEYS, INNGEST_OPTIONS } from '@system/queues/events.config.js';

import { inngest } from './event-publisher.service.js';

const logger = new Logger('FailedEvents');

/** fired when any function exhausts its retries; the only place a dropped job
 *  becomes visible, so it must never be silent */
export const failedEvents = (): InngestFunction.Any =>
  inngest.createFunction(
    {
      id: 'failed-events',
      ...INNGEST_OPTIONS,
      triggers: { event: EVENT_KEYS.FAILED_EVENT },
    },
    async ({ event }) => {
      logger.error(
        `inngest function failed: ${event.data.function_id}`,
        event.data.error?.stack,
      );
    },
  );
