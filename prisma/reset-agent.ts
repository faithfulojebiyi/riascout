import { Client } from 'pg';

/**
 * Drops the mastra-owned `agent` schema. Prisma never manages it, so
 * `migrate reset` leaves it behind; mastra recreates its tables on the next
 * api boot. Local development only — this deletes every chat thread.
 */
const main = async (): Promise<void> => {
  const connectionString = process.env.APP_DATABASE_URL?.replace(/\?schema=\w+/, '');

  if (!connectionString) {
    throw new Error('APP_DATABASE_URL is not set');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('refusing to drop the agent schema in production');
  }

  const db = new Client({ connectionString });
  await db.connect();

  try {
    await db.query('drop schema if exists agent cascade');
    console.log('  dropped schema agent');
  } finally {
    await db.end();
  }
};

await main();
