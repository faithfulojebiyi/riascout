import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', () => ({
  existsSync: vi.fn<() => boolean>(() => true),
  statSync: vi.fn<() => { size: number }>(() => ({ size: 123 })),
}));

vi.mock('./duck.js', () => ({
  duckScalar: vi.fn<() => Promise<number>>(async () => 1),
}));

import { preflight } from './preflight.js';

describe('market data preflight', () => {
  const originalEnv = process.env;
  const retiredDataDirKey = ['ASSET', 'DATA', 'DIR'].join('_');

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      APP_DATABASE_URL: 'postgresql://user:pass@localhost:5432/riascout?schema=app',
    };
    delete process.env[retiredDataDirKey];
    delete process.env.MARKET_DATA_DIR;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('resolves analysis.duckdb from MARKET_DATA_DIR', async () => {
    process.env.MARKET_DATA_DIR = '/tmp/riascout-market-data';

    const result = await preflight(false);

    expect(result.seedPath).toBe('/tmp/riascout-market-data/analysis.duckdb');
    expect(result.seedBytes).toBe(123);
  });

  it('does not accept the retired environment variable', async () => {
    process.env[retiredDataDirKey] = '/tmp/retired-data';

    await expect(preflight(false)).rejects.toThrow('MARKET_DATA_DIR is not set');
  });
});
