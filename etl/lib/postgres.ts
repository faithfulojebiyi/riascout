import { spawn } from 'node:child_process';

/**
 * The derived and projection stages are pure postgres — temp tables, window
 * functions, to_tsvector, jsonb_agg — none of which survive a trip through
 * duckdb's postgres scanner. They run through psql directly instead.
 */
export async function runPsql(sql: string, postgresUrl: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      'psql',
      [postgresUrl, '-v', 'ON_ERROR_STOP=1', '-q', '-f', '-'],
      {
        stdio: ['pipe', 'inherit', 'inherit'],
      },
    );

    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`psql exited ${code}`)),
    );

    child.stdin.write(sql);
    child.stdin.end();
  });
}
