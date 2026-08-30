/**
 * Loads the market schema from the seed DuckDB.
 * Usage: bun etl/load-market.ts [--only=identity,filings] [--list]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { runDuck, type DuckOptions } from './lib/duck.js';
import { acquire } from './lib/lock.js';
import { runPsql } from './lib/postgres.js';
import { refreshFacetOptions } from './refresh-facet-options.js';
import { preflight } from './lib/preflight.js';

/**
 * duck stages read the seed; postgres stages only reshape what is already
 * loaded; a node stage needs the allowlist, which lives in typescript.
 */
type Stage = {
  key: string;
  file?: string;
  label: string;
  engine?: 'duck' | 'postgres' | 'node';
  run?: (postgresUrl: string) => Promise<unknown>;
};

/**
 * Order matters: the derived tables feed the projections, and firm-derived
 * needs advisor registrations for its advisor counts. Leaving the derived and
 * projection stages unregistered is what left firm_fact_derived empty, and with
 * it every aum_band and channel on both projections.
 */
const STAGES: Stage[] = [
  { key: 'reset', file: '000-reset.sql', label: 'truncate (full reload only)' },
  { key: 'identity', file: '010-identity.sql', label: 'firms + advisors' },
  { key: 'filings', file: '020-filings.sql', label: 'filing spine' },
  { key: 'firm-facts', file: '030-firm-facts.sql', label: 'firm facts' },
  {
    key: 'advisor',
    file: '040-advisor.sql',
    label: 'advisor detail + registrations',
  },
  {
    key: 'advisor-derived',
    file: '045-advisor-derived.sql',
    label: 'advisor tenure + experience',
    engine: 'postgres',
  },
  {
    key: 'movement',
    file: '047-advisor-movement.sql',
    label: 'advisor movement',
    engine: 'postgres',
  },
  {
    key: 'firm-derived',
    file: '046-firm-derived.sql',
    label: 'firm ratios, bands, channel',
    engine: 'postgres',
  },
  {
    key: 'advisor-search',
    file: '050-search-projections.sql',
    label: 'advisor_search projection',
    engine: 'postgres',
  },
  {
    key: 'firm-search',
    file: '051-firm-search.sql',
    label: 'firm_search projection',
    engine: 'postgres',
  },
  {
    key: 'facet-options',
    label: 'facet option values',
    engine: 'node',
    run: refreshFacetOptions,
  },
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

  const selected = STAGES.filter((s) =>
    only ? only.has(s.key) : s.key !== 'reset',
  );
  const needsSeed = selected.some(
    (s) => s.engine !== 'postgres' && s.engine !== 'node',
  );

  const pre = await preflight(needsSeed);

  const opts: DuckOptions = {
    seedPath: pre.seedPath,
    postgresUrl: pre.postgresUrl,
  };

  if (needsSeed) {
    console.log(
      `seed  ${pre.seedPath} (${(pre.seedBytes / 1e9).toFixed(2)} GB)`,
    );
  }

  console.log(`run   ${pre.runId}\n`);
  const startedAll = Date.now();

  for (const stage of selected) {
    const started = Date.now();

    process.stdout.write(`  ${stage.key.padEnd(12)} ${stage.label} … `);

    try {
      if (stage.engine === 'node') {
        await stage.run?.(pre.postgresUrl);
      } else {
        const sql = readFileSync(join(SQL_DIR, stage.file ?? ''), 'utf8');

        if (stage.engine === 'postgres') {
          await runPsql(sql, pre.postgresUrl);
        } else {
          await runDuck(sql, opts);
        }
      }

      console.log(seconds(Date.now() - started));
    } catch (error) {
      console.log('FAILED');
      throw error;
    }
  }

  console.log(`\ndone in ${seconds(Date.now() - startedAll)}`);
}

await main();
