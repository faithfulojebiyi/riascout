import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

/**
 * Single-runner lock. The seed DuckDB permits one writer, and a stray
 * read-only attach from our side blocks the seed repo's own ingestion —
 * so never leave more than one loader running.
 */
const LOCK = join(dirname(import.meta.dirname), '.load.lock');

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

export function acquire(): void {
  if (existsSync(LOCK)) {
    const pid = Number(readFileSync(LOCK, 'utf8').trim());

    if (Number.isFinite(pid) && isAlive(pid)) {
      throw new Error(
        `Another loader is already running (pid ${pid}).\n` +
          'Two loaders means two DuckDB attaches, which blocks the seed repo.\n' +
          `Wait for it, or: kill ${pid} && rm ${LOCK}`,
      );
    }

    rmSync(LOCK, { force: true });
  }

  writeFileSync(LOCK, String(process.pid));

  // release on every exit path, so a crash does not strand the seed database
  const release = (): void => rmSync(LOCK, { force: true });

  process.on('exit', release);

  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(sig, () => {
      release();
      process.exit(130);
    });
  }
}
