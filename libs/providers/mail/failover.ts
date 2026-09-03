import { MailTransportError } from './errors.js';

export type FallbackConfig = {
  /**
   * What to do when a transport failed without telling us whether the message
   * went out. Defaults to stopping: continuing can deliver the message twice,
   * because idempotency keys do not span providers.
   */
  onUnknownDelivery?: 'stop' | 'continue';
};

export type RetryConfig = {
  maxAttempts?: number;
  delay?: (attempt: number, error: MailTransportError) => number;
  shouldRetry?: (error: MailTransportError, attempt: number) => boolean;
};

export const DEFAULT_MAX_ATTEMPTS = 3;

/** exponential with jitter, so a provider blip does not synchronise retries */
export const defaultDelay = (attempt: number): number =>
  Math.min(2 ** (attempt - 1) * 250, 4_000) + Math.floor(Math.random() * 100);

export const defaultShouldRetry = (error: MailTransportError): boolean =>
  error.retryable;

/**
 * Whether the same message may be handed to the next transport. `not_sent` is
 * the only state that makes that provably safe.
 */
export const canFallback = (
  error: MailTransportError,
  fallback?: FallbackConfig,
): boolean =>
  error.delivery === 'not_sent' || fallback?.onUnknownDelivery === 'continue';
