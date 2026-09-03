import type { InngestFunction } from 'inngest';

import { EVENTS, INNGEST_OPTIONS } from '@system/queues/events.config.js';

import type { InngestFunctionDto } from '../../event-publisher/event-publisher.dto.js';
import { inngest } from '../../event-publisher/event-publisher.service.js';
import { SendMailCommand } from '../commands/send-mail.js';

/**
 * One step, so a retry replays the whole send. The idempotency key is what makes
 * that safe: the provider returns the original response rather than delivering
 * a second copy.
 */
export const sendMail = ({
  commandBus,
}: InngestFunctionDto): InngestFunction.Any =>
  inngest.createFunction(
    {
      id: 'send-mail',
      ...INNGEST_OPTIONS,
      triggers: [EVENTS.MAIL_SEND],
    },
    async ({ event, step }) =>
      step.run('send', async () =>
        commandBus.execute(new SendMailCommand(event.data)),
      ),
  );
