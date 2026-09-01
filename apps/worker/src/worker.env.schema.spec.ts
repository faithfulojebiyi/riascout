import { describe, expect, it } from 'vitest';

import { workerEnvSchema } from './worker.env.schema.js';

describe('workerEnvSchema', () => {
  const retiredDataDirKey = ['ASSET', 'DATA', 'DIR'].join('_');

  it('accepts MARKET_DATA_DIR', () => {
    const result = workerEnvSchema.validate({ MARKET_DATA_DIR: '/tmp/riascout-market-data' });

    expect(result.error).toBeUndefined();
    expect(result.value.MARKET_DATA_DIR).toBe('/tmp/riascout-market-data');
  });

  it('rejects the retired market-data variable', () => {
    const result = workerEnvSchema.validate({ [retiredDataDirKey]: '/tmp/retired-data' });

    expect(result.error).toBeDefined();
  });
});
