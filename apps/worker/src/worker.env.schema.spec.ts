import { describe, expect, it } from 'vitest';

import { workerEnvSchema } from './worker.env.schema.js';

describe('workerEnvSchema', () => {
  const retiredDataDirKey = ['ASSET', 'DATA', 'DIR'].join('_');

  /** every valid payload needs these; asserted on its own below */
  const required = { RESEND_API_KEY: 're_test_key' };

  it('accepts MARKET_DATA_DIR', () => {
    const result = workerEnvSchema.validate({
      ...required,
      MARKET_DATA_DIR: '/tmp/riascout-market-data',
    });

    expect(result.error).toBeUndefined();
    expect(result.value.MARKET_DATA_DIR).toBe('/tmp/riascout-market-data');
  });

  it('rejects the retired market-data variable', () => {
    const result = workerEnvSchema.validate({
      ...required,
      [retiredDataDirKey]: '/tmp/retired-data',
    });

    expect(result.error).toBeDefined();
  });

  /**
   * The worker sends queued invites, so a missing key is a boot failure rather
   * than a job that fails once it is already queued.
   */
  it('requires a mail key', () => {
    const result = workerEnvSchema.validate({});

    expect(result.error?.message).toContain('RESEND_API_KEY');
  });

  it('defaults the sender to the sandbox address', () => {
    const result = workerEnvSchema.validate(required);

    expect(result.value.MAIL_FROM).toBe('onboarding@resend.dev');
  });
});
