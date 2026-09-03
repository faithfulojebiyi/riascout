import { describe, expect, it } from 'vitest';

import { MailTransportError, classifyTransportError } from './errors.js';
import { canFallback, defaultShouldRetry } from './failover.js';

/**
 * The rule this guards: a message may only be handed to a second transport when
 * the first provably did not send it. Getting it wrong delivers twice, and
 * idempotency keys are per-provider so they cannot catch it.
 */
describe('mail failover', () => {
  const errorWith = (code: string): Error =>
    Object.assign(new Error(code), { code });

  describe('classification', () => {
    it('treats a dns failure as never sent, and retryable', () => {
      const error = classifyTransportError('resend', errorWith('ENOTFOUND'));

      expect(error.delivery).toBe('not_sent');
      expect(error.retryable).toBe(true);
    });

    it('treats a refused connection as never sent', () => {
      const error = classifyTransportError('resend', errorWith('ECONNREFUSED'));

      expect(error.delivery).toBe('not_sent');
    });

    it.each([429, 500, 503])('treats %i as never sent and retryable', (status) => {
      const error = classifyTransportError('resend', new Error('x'), status);

      expect(error.delivery).toBe('not_sent');
      expect(error.retryable).toBe(true);
    });

    it.each([400, 403, 422])('does not retry %i against the same transport', (status) => {
      const error = classifyTransportError('resend', new Error('x'), status);

      expect(error.retryable).toBe(false);
      // still not_sent: the provider rejected it outright
      expect(error.delivery).toBe('not_sent');
    });

    /**
     * The important one. A socket timeout carries no status and no pre-connect
     * code, so we cannot know whether the provider accepted the message.
     */
    it('treats a timeout as unknown delivery, not as never sent', () => {
      const error = classifyTransportError('resend', errorWith('ETIMEDOUT'));

      expect(error.delivery).toBe('unknown');
      expect(error.retryable).toBe(false);
    });
  });

  describe('canFallback', () => {
    const withDelivery = (delivery: 'not_sent' | 'unknown') =>
      new MailTransportError('x', {
        transport: 'resend',
        retryable: false,
        delivery,
      });

    it('moves on when the message provably did not go out', () => {
      expect(canFallback(withDelivery('not_sent'))).toBe(true);
    });

    it('stops on unknown delivery by default', () => {
      expect(canFallback(withDelivery('unknown'))).toBe(false);
    });

    it('moves on for unknown delivery only when explicitly opted in', () => {
      expect(
        canFallback(withDelivery('unknown'), { onUnknownDelivery: 'continue' }),
      ).toBe(true);
      expect(
        canFallback(withDelivery('unknown'), { onUnknownDelivery: 'stop' }),
      ).toBe(false);
    });
  });

  it('defaults retry to the error, not to the status', () => {
    expect(defaultShouldRetry(classifyTransportError('r', new Error('x'), 500))).toBe(
      true,
    );
    expect(defaultShouldRetry(classifyTransportError('r', new Error('x'), 422))).toBe(
      false,
    );
  });
});
