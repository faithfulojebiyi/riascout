import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Guards the DDL that Prisma's schema language cannot express, and that a
 * careless `migrate reset` would therefore drop silently. Extend this whenever
 * a migration hand-appends a constraint, partition or generated column.
 */
describe('schema invariants', () => {
  let db: Client;

  beforeAll(async () => {
    const connectionString = process.env.APP_DATABASE_URL;

    if (!connectionString) {
      throw new Error('APP_DATABASE_URL is required to run schema invariant tests');
    }

    db = new Client({ connectionString });
    await db.connect();
  });

  afterAll(async () => {
    await db?.end();
  });

  const constraintExists = async (name: string, type: string): Promise<boolean> => {
    const { rows } = await db.query<{ exists: boolean }>(
      `select exists (
         select 1 from pg_constraint c
         join pg_class t on t.oid = c.conrelid
         join pg_namespace n on n.oid = t.relnamespace
         where c.conname = $1 and c.contype = $2
       ) as exists`,
      [name, type],
    );

    return rows[0]?.exists ?? false;
  };

  const indexExists = async (name: string): Promise<boolean> => {
    const { rows } = await db.query<{ exists: boolean }>(
      `select exists (select 1 from pg_indexes where indexname = $1) as exists`,
      [name],
    );

    return rows[0]?.exists ?? false;
  };

  it('has btree_gist installed', async () => {
    const { rows } = await db.query<{ extname: string }>(
      `select extname from pg_extension where extname = 'btree_gist'`,
    );

    expect(rows).toHaveLength(1);
  });

  it('enforces non-overlapping advisor tenures via a GiST exclusion constraint', async () => {
    await expect(constraintExists('advisor_tenure_no_overlap', 'x')).resolves.toBe(true);
  });

  it('enforces half-open interval ordering via a check constraint', async () => {
    await expect(constraintExists('advisor_tenure_ordered', 'c')).resolves.toBe(true);
  });

  it('has the tenure period expression index', async () => {
    await expect(indexExists('advisor_tenure_period_gist')).resolves.toBe(true);
  });

  it('has the current-roster partial index', async () => {
    await expect(indexExists('advisor_tenure_current_by_firm')).resolves.toBe(true);
  });

  it('rejects an overlapping tenure at the database level', async () => {
    await db.query('begin');

    try {
      await db.query(`insert into market.advisor (advisor_crd) values (999000001)
                      on conflict do nothing`);
      await db.query(`insert into market.advisor_tenure
        (advisor_crd, source_employer_name, kind, start_date, end_date)
        values (999000001, 'A', 'registration', '2020-01-01', '2023-01-01')`);

      await expect(
        db.query(`insert into market.advisor_tenure
          (advisor_crd, source_employer_name, kind, start_date, end_date)
          values (999000001, 'B', 'registration', '2022-01-01', '2024-01-01')`),
      ).rejects.toThrow(/exclusion constraint/i);
    } finally {
      await db.query('rollback');
    }
  });

  it('keeps market free of tenancy columns', async () => {
    const { rows } = await db.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
        where table_schema = 'market' and column_name in ('workspace_id', 'organization_id')`,
    );

    expect(rows).toEqual([]);
  });
});
