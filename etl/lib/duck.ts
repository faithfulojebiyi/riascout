import { spawn } from 'node:child_process';

/**
 * Runs SQL against the seed DuckDB with Postgres attached as `pg`.
 * Shelling out to the CLI avoids native-binding issues under bun.
 */
export type DuckOptions = {
  seedPath: string;
  postgresUrl: string;
  /** attach the seed read-only; DuckDB permits a single writer */
  readOnlySeed?: boolean;
};

const PREAMBLE = (opts: DuckOptions): string =>
  [
    'load postgres;',
    `attach '${opts.postgresUrl}' as pg (type postgres, read_only false);`,
    'set preserve_insertion_order = false;',
  ].join('\n');

export async function runDuck(sql: string, opts: DuckOptions): Promise<string> {
  const args = opts.readOnlySeed === false ? [] : ['-readonly'];
  const script = `${PREAMBLE(opts)}\n${sql}`;

  return new Promise((resolve, reject) => {
    const child = spawn('duckdb', [...args, opts.seedPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));

    child.on('error', reject);
    child.on('close', (code) => {
      const combined = `${stdout}${stderr}`;

      // duckdb exits 0 on some statement errors, so scan the output too
      if (code !== 0 || /\b(Error|error:)\b/.test(stderr)) {
        reject(new Error(`duckdb failed (exit ${code}):\n${combined.trim()}`));

        return;
      }

      resolve(stdout);
    });

    child.stdin.write(script);
    child.stdin.end();
  });
}

/** Single scalar, for counts and probes. */
export async function duckScalar(sql: string, opts: DuckOptions): Promise<string> {
  const out = await runDuck(`.mode list\n.headers off\n${sql}`, opts);

  return out.trim().split('\n').filter(Boolean).at(-1) ?? '';
}
