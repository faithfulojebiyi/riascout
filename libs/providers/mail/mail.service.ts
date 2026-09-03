import { Injectable, Logger } from '@nestjs/common';

import { MailTransportError } from './errors.js';
import {
  DEFAULT_MAX_ATTEMPTS,
  canFallback,
  defaultDelay,
  defaultShouldRetry,
  type FallbackConfig,
  type RetryConfig,
} from './failover.js';
import { renderTemplate, type MailTemplateName, type MailTemplates } from './templates.js';
import type { MailSendResult, MailTransport } from './transport.js';
import { logTransport } from './transports/log.transport.js';
import { resendTransport } from './transports/resend.transport.js';

export type SendMailInput<K extends MailTemplateName = MailTemplateName> = {
  to: string | string[];
  template: K;
  props: MailTemplates[K];
  /** `<event-type>/<entity-id>`; absorbs a retry against the same transport */
  idempotencyKey?: string;
};

const REGISTRY: Record<string, MailTransport> = {
  [resendTransport.name]: resendTransport,
  [logTransport.name]: logTransport,
};

/**
 * A list, because the send walks it in order. One entry today — the second is
 * what canFallback exists for.
 */
const transports = (): MailTransport[] => {
  const name = process.env.MAIL_TRANSPORT ?? resendTransport.name;
  const transport = REGISTRY[name];

  if (!transport) {
    throw new Error(
      `Unknown MAIL_TRANSPORT "${name}"; expected one of ${Object.keys(REGISTRY).join(', ')}`,
    );
  }

  return [transport];
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Renders a template, then walks the transport list. With one transport
 * registered the fallback never fires, but the rule it encodes is the part that
 * is easy to get wrong later.
 */
export const sendMail = async (
  input: SendMailInput,
  options: { retry?: RetryConfig; fallback?: FallbackConfig } = {},
): Promise<MailSendResult> => {
  const { subject, html, text } = await renderTemplate(
    input.template,
    input.props,
  );
  const from = process.env.MAIL_FROM ?? 'onboarding@resend.dev';
  const message = {
    from,
    to: input.to,
    subject,
    html,
    text,
    idempotencyKey: input.idempotencyKey,
  };

  const maxAttempts = options.retry?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const shouldRetry = options.retry?.shouldRetry ?? defaultShouldRetry;
  const delay = options.retry?.delay ?? defaultDelay;

  const chain = transports();

  let last: MailTransportError | undefined;

  for (const [index, transport] of chain.entries()) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await transport.send(message);
      } catch (error) {
        if (!(error instanceof MailTransportError)) {
          throw error;
        }

        last = error;

        if (attempt < maxAttempts && shouldRetry(error, attempt)) {
          await sleep(delay(attempt, error));
          continue;
        }

        break;
      }
    }

    const hasNext = index < chain.length - 1;

    if (!last || !hasNext || !canFallback(last, options.fallback)) {
      break;
    }
  }

  throw last ?? new Error('no mail transport is registered');
};

@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');

  async send(input: SendMailInput): Promise<MailSendResult> {
    const result = await sendMail(input);

    // the recipient is not logged: an address is personal data, and the
    // template plus message id is enough to trace a delivery
    this.logger.log(`sent ${input.template} via ${result.transport}`);

    return result;
  }
}
