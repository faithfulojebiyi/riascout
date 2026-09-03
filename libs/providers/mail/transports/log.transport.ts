import { Logger } from '@nestjs/common';

import type { MailMessage, MailSendResult, MailTransport } from '../transport.js';

const logger = new Logger('MailLog');

/**
 * Development only. Writes the message instead of sending it, so the app runs
 * without a provider account and a sign-in code is still reachable.
 *
 * It logs the body because that is the whole point — a sign-in code has to be
 * readable — which is also why selecting it is refused outside development.
 */
export const logTransport: MailTransport = {
  name: 'log',

  capabilities: { attachments: false, scheduling: false, tags: false },

  async send(message: MailMessage): Promise<MailSendResult> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'the log mail transport cannot be used in production; it delivers nothing',
      );
    }

    logger.log(
      `to ${Array.isArray(message.to) ? message.to.join(', ') : message.to} — ${message.subject}`,
    );
    logger.debug(message.text ?? message.html);

    return { transport: 'log', id: `log-${Date.now()}` };
  },
};
