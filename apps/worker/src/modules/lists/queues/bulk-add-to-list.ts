import type { InngestFunction } from 'inngest';

import { EVENTS, INNGEST_OPTIONS } from '@system/queues/events.config.js';

import type { InngestFunctionDto } from '../../event-publisher/event-publisher.dto.js';
import { inngest } from '../../event-publisher/event-publisher.service.js';
import { BulkAddToListCommand } from '../commands/bulk-add-to-list.js';

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
