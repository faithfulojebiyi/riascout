/**
 * Loads the market schema from the seed DuckDB.
 * Usage: bun etl/load-market.ts [--only=identity,filings] [--list]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { runDuck, type DuckOptions } from './lib/duck.js';
import { acquire } from './lib/lock.js';
import { preflight } from './lib/preflight.js';

type Stage = { key: string; file: string; label: string };

const STAGES: Stage[] = [
  { key: 'reset', file: '000-reset.sql', label: 'truncate (full reload only)' },
  { key: 'identity', file: '010-identity.sql', label: 'firms + advisors' },
  { key: 'filings', file: '020-filings.sql', label: 'filing spine' },
  { key: 'firm-facts', file: '030-firm-facts.sql', label: 'firm facts' },
  { key: 'advisor', file: '040-advisor.sql', label: 'advisor detail + registrations' },
];

const SQL_DIR = join(import.meta.dirname, 'sql');

function parseOnly(argv: string[]): Set<string> | null {
  const arg = argv.find((a) => a.startsWith('--only='));

  if (!arg) {
    return null;
  }

  const keys = arg
    .slice('--only='.length)
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  const unknown = keys.filter((k) => !STAGES.some((s) => s.key === k));

  if (unknown.length > 0) {
    throw new Error(
      `Unknown stage(s): ${unknown.join(', ')}\nAvailable: ${STAGES.map((s) => s.key).join(', ')}`,
    );
  }

  return new Set(keys);
}

const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;

async function main(): Promise<void> {
  if (process.argv.includes('--list')) {
    for (const s of STAGES) {
      console.log(`  ${s.key.padEnd(12)} ${s.label}`);
    }

    return;
  }

  const only = parseOnly(process.argv);

  acquire();

  const pre = await preflight();

  const opts: DuckOptions = { seedPath: pre.seedPath, postgresUrl: pre.postgresUrl };

  console.log(`seed  ${pre.seedPath} (${(pre.seedBytes / 1e9).toFixed(2)} GB)`);
  console.log(`run   ${pre.runId}\n`);

  const selected = STAGES.filter((s) => (only ? only.has(s.key) : s.key !== 'reset'));
  const startedAll = Date.now();

  for (const stage of selected) {
    const sql = readFileSync(join(SQL_DIR, stage.file), 'utf8');
    const started = Date.now();

    process.stdout.write(`  ${stage.key.padEnd(12)} ${stage.label} … `);

    try {
      await runDuck(sql, opts);
      console.log(seconds(Date.now() - started));
    } catch (error) {
      console.log('FAILED');
      throw error;
    }
  }

  console.log(`\ndone in ${seconds(Date.now() - startedAll)}`);
}

await main();
