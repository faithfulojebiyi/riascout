import { Resend } from 'resend';

import { MailTransportError, classifyTransportError } from '../errors.js';
import type { MailMessage, MailSendResult, MailTransport } from '../transport.js';

const NAME = 'resend';

/**
 * Constructed at module scope, like the Inngest client: the key is read once, so
 * load-env must already have run. auth.ts sends outside Nest DI and needs this
 * reachable without a container.
 */
let client: Resend | null = null;

const resendClient = (): Resend => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is required to send mail');
  }

  client ??= new Resend(apiKey);

  return client;
};

export const resendTransport: MailTransport = {
  name: NAME,

  capabilities: { attachments: true, scheduling: true, tags: true },

  async send(message: MailMessage): Promise<MailSendResult> {
    let response;

    try {
      /**
       * The SDK returns { data, error } and does not throw for API errors, so a
       * try/catch here only ever catches transport-level faults.
       */
      response = await resendClient().emails.send(
        {
          from: message.from,
          to: message.to,
          subject: message.subject,
          replyTo: message.replyTo,
          html: message.html,
          text: message.text,
        } as Parameters<Resend['emails']['send']>[0],
        { idempotencyKey: message.idempotencyKey },
      );
    } catch (error) {
      throw classifyTransportError(NAME, error);
    }

    if (response.error) {
      throw classifyTransportError(
        NAME,
        new Error(response.error.message),
        response.error.statusCode ?? undefined,
      );
    }

    if (!response.data?.id) {
      // accepted with no id is not something the API documents; do not guess
      throw new MailTransportError('resend returned no message id', {
        transport: NAME,
        retryable: false,
        delivery: 'unknown',
      });
    }

    return { transport: NAME, id: response.data.id };
  },
};
