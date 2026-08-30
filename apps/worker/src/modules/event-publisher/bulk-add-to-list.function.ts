import type { InngestFunction } from 'inngest';

import { EVENTS, INNGEST_OPTIONS } from '@system/queues/events.config.js';

import { BulkAddToListCommand } from '../lists/commands/bulk-add-to-list.js';
import type { InngestFunctionDto } from './event-publisher.dto.js';
import { inngest } from './event-publisher.service.js';

/**
 * One step, so a retry replays the whole command. Both statements underneath
 * are idempotent, so replaying is harmless and cheaper than tracking progress.
 */
export const bulkAddToList = ({
  commandBus,
}: InngestFunctionDto): InngestFunction.Any =>
  inngest.createFunction(
    {
      id: 'bulk-add-to-list',
      ...INNGEST_OPTIONS,
      triggers: [EVENTS.LIST_BULK_ADD],
    },
    async ({ event, step }) =>
      step.run('add', async () =>
        commandBus.execute(new BulkAddToListCommand(event.data)),
      ),
  );
