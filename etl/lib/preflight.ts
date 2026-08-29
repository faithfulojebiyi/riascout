import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { duckScalar, type DuckOptions } from './duck.js';

export type Preflight = {
  seedPath: string;
  postgresUrl: string;
  runId: string;
  seedBytes: number;
};

/**
 * The seed repo is under active development and DuckDB permits one writer, so
 * a held lock is a normal condition rather than an exception. Fail with an
 * explanation — the native error is a bare "Could not set lock on file".
 */
/**
 * needsSeed false for postgres-only runs: those never open the seed, so a
 * concurrent ingestion holding its write lock must not block them.
 */
export async function preflight(needsSeed = true): Promise<Preflight> {
  const dataDir = process.env.ASSET_DATA_DIR;

  if (!dataDir) {
    throw new Error(
      'ASSET_DATA_DIR is not set. Copy .env.local.example to .env.local and point it at the seed data directory.',
    );
  }

  const seedPath = join(dataDir, 'analysis.duckdb');

  if (!existsSync(seedPath)) {
    throw new Error(`Seed database not found at ${seedPath}`);
  }

  const rawUrl = process.env.APP_DATABASE_URL;

  if (!rawUrl) {
    throw new Error('APP_DATABASE_URL is required');
  }

  // ?schema= is Prisma-specific and libpq rejects it. We address pg.market.*
  // schema-qualified, so the search_path is irrelevant here.
  const parsed = new URL(rawUrl);
  parsed.search = '';
  const postgresUrl = parsed.toString();

  const opts: DuckOptions = { seedPath, postgresUrl };

  try {
    if (needsSeed) {
      await duckScalar('select 1;', opts);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (/Could not set lock/i.test(message)) {
      throw new Error(
        'The seed database is write-locked, which means an ingestion is running.\n' +
          'DuckDB permits a single writer. Wait for it to finish, then re-run.\n' +
          'Loading against a half-written database would produce silently wrong counts.',
      );
    }

    throw error;
  }

  return {
    seedPath,
    postgresUrl,
    runId: crypto.randomUUID(),
    seedBytes: statSync(seedPath).size,
  };
}
