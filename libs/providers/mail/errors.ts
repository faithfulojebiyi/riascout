/**
 * Two independent axes, and collapsing them is what causes duplicate sends.
 *
 * `retryable` answers "retry this same transport?".
 * `delivery` answers "did the message provably not go out?" — only `not_sent`
 * makes it safe to hand the same message to a different transport.
 */
export type MailDelivery = 'not_sent' | 'unknown';

export type MailTransportErrorOptions = {
  transport: string;
  retryable: boolean;
  delivery: MailDelivery;
  status?: number;
  cause?: unknown;
};

export class MailTransportError extends Error {
  readonly transport: string;
  readonly retryable: boolean;
  readonly delivery: MailDelivery;
  readonly status?: number;

  constructor(message: string, options: MailTransportErrorOptions) {
    super(message, { cause: options.cause });
    this.name = 'MailTransportError';
    this.transport = options.transport;
    this.retryable = options.retryable;
    this.delivery = options.delivery;
    this.status = options.status;
  }
}

/**
 * A request that never reached the provider is safe to retry and safe to move
 * on from. Anything else defaults to `unknown`, which is the conservative side:
 * the send may already have happened.
 */
export const classifyTransportError = (
  transport: string,
  error: unknown,
  status?: number,
): MailTransportError => {
  const message = error instanceof Error ? error.message : String(error);

  if (status !== undefined) {
    // 429 and 5xx are the provider declining to act, so nothing was sent
    const retryable = status === 429 || status >= 500;

    return new MailTransportError(message, {
      transport,
      retryable,
      delivery: 'not_sent',
      status,
      cause: error,
    });
  }

  const code =
    error instanceof Error && 'code' in error ? String(error.code) : '';

  /**
   * Pre-connection failures only. A timeout is deliberately excluded: the
   * request may have been accepted before the clock ran out, and idempotency
   * keys are per-provider so they do not protect a fallback.
   */
  const neverSent =
    code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'EAI_AGAIN';

  return new MailTransportError(message, {
    transport,
    retryable: neverSent,
    delivery: neverSent ? 'not_sent' : 'unknown',
    cause: error,
  });
};
