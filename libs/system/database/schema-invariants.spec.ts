import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Guards the DDL that Prisma's schema language cannot express, and that a
 * careless `migrate reset` would therefore drop silently. Extend this whenever
 * a migration hand-appends a constraint, index or view.
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
         select 1 from pg_constraint where conname = $1 and contype = $2
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

  const viewExists = async (schema: string, name: string): Promise<boolean> => {
    const { rows } = await db.query<{ exists: boolean }>(
      `select exists (
         select 1 from information_schema.views
         where table_schema = $1 and table_name = $2
       ) as exists`,
      [schema, name],
    );

    return rows[0]?.exists ?? false;
  };

  it('has btree_gist installed', async () => {
    const { rows } = await db.query(`select 1 from pg_extension where extname = 'btree_gist'`);

    expect(rows).toHaveLength(1);
  });

  describe('exclusion constraints', () => {
    it('prevents overlapping advisor registrations', async () => {
      await expect(constraintExists('advisor_registration_no_overlap', 'x')).resolves.toBe(true);
    });
  });

  describe('check constraints', () => {
    const checks = [
      'advisor_registration_ordered',
      'advisor_employment_ordered',
      'contact_point_kind_subtype',
      'contact_point_status_valid',
      'firm_fact_derived_percentile_range',
      'asset_allocation_pct_range',
      'firm_fact_owner_kind_valid',
      'firm_fact_owner_schedule_valid',
      'firm_fact_owner_crd_only_individual',
      'enrichment_request_outcome_valid',
      'enrichment_request_subject_valid',
    ];

    it.each(checks)('has %s', async (name) => {
      await expect(constraintExists(name, 'c')).resolves.toBe(true);
    });
  });

  describe('hand-appended indexes', () => {
    const indexes = [
      'advisor_registration_period_gist',
      'advisor_registration_current',
      'advisor_contact_point_one_primary',
      'advisor_contact_point_reachable',
    ];

    it.each(indexes)('has %s', async (name) => {
      await expect(indexExists(name)).resolves.toBe(true);
    });
  });

  describe('views', () => {
    it.each([
      ['market', 'firm_current_filing'],
      ['market', 'advisor_current_firm'],
    ])('has %s.%s', async (schema, name) => {
      await expect(viewExists(schema, name)).resolves.toBe(true);
    });
  });

  describe('registration overlap semantics', () => {
    const advisorCrd = 999_000_101;
    const firmA = 999_000_201;
    const firmB = 999_000_202;

    const seed = async (): Promise<void> => {
      await db.query(`insert into market.advisor (advisor_crd) values ($1)
                      on conflict do nothing`, [advisorCrd]);
      await db.query(`insert into market.firm (firm_crd) values ($1), ($2)
                      on conflict do nothing`, [firmA, firmB]);
    };

    const insertReg = (
      firmCrd: number,
      jurisdiction: string | null,
      start: string,
      end: string | null,
    ): Promise<unknown> =>
      db.query(
        `insert into market.advisor_registration
           (advisor_crd, employer_firm_crd, jurisdiction, start_date, end_date)
         values ($1, $2, $3, $4, $5)`,
        [advisorCrd, firmCrd, jurisdiction, start, end],
      );

    it('accepts many simultaneous registrations across jurisdictions', async () => {
      await db.query('begin');

      try {
        await seed();

        for (const state of ['IN', 'KY', 'MI', 'NE', 'OH', 'PA']) {
          await expect(insertReg(firmA, state, '2023-01-25', null)).resolves.toBeDefined();
        }
      } finally {
        await db.query('rollback');
      }
    });

    it('accepts simultaneous registrations at two different firms', async () => {
      await db.query('begin');

      try {
        await seed();
        await insertReg(firmA, 'IN', '2023-01-25', null);

        await expect(insertReg(firmB, 'IN', '2024-06-01', null)).resolves.toBeDefined();
      } finally {
        await db.query('rollback');
      }
    });

    it('rejects an overlap within the same advisor, firm and jurisdiction', async () => {
      await db.query('begin');

      try {
        await seed();
        await insertReg(firmA, 'IN', '2023-01-25', null);

        await expect(insertReg(firmA, 'IN', '2023-06-01', null)).rejects.toThrow(
          /exclusion constraint/i,
        );
      } finally {
        await db.query('rollback');
      }
    });

    it('rejects an overlap when jurisdiction is NULL on both rows', async () => {
      await db.query('begin');

      try {
        await seed();
        await insertReg(firmA, null, '2015-01-01', '2016-01-01');

        // without COALESCE in the constraint, GiST treats NULLs as distinct
        // and this would be silently permitted
        await expect(insertReg(firmA, null, '2015-06-01', '2016-06-01')).rejects.toThrow(
          /exclusion constraint/i,
        );
      } finally {
        await db.query('rollback');
      }
    });

    it('treats adjacent half-open intervals as non-overlapping', async () => {
      await db.query('begin');

      try {
        await seed();
        await insertReg(firmA, 'IN', '2020-01-01', '2023-01-01');

        // left firm A the day they joined firm B — not an overlap
        await expect(insertReg(firmA, 'IN', '2023-01-01', null)).resolves.toBeDefined();
      } finally {
        await db.query('rollback');
      }
    });

    it('rejects an inverted interval', async () => {
      await db.query('begin');

      try {
        await seed();

        await expect(insertReg(firmA, 'IN', '2025-01-01', '2024-01-01')).rejects.toThrow(
          /advisor_registration_ordered/i,
        );
      } finally {
        await db.query('rollback');
      }
    });
  });

  describe('ownership constraints', () => {
    it('rejects an advisor CRD on an entity owner', async () => {
      await db.query('begin');

      try {
        await db.query(`insert into market.firm (firm_crd) values (999000301)
                        on conflict do nothing`);
        await db.query(
          `insert into market.filing (filing_id, firm_crd) values ('inv-test-1', 999000301)`,
        );

        await expect(
          db.query(`insert into market.firm_fact_owner
            (filing_id, schedule, owner_ref, owner_kind, owner_advisor_crd, full_legal_name)
            values ('inv-test-1', 'A', 'r1', 'domestic_entity', 12345, 'ACME HOLDINGS LLC')`),
        ).rejects.toThrow(/firm_fact_owner_crd_only_individual/i);
      } finally {
        await db.query('rollback');
      }
    });
  });

  describe('tenancy', () => {
    it('keeps market free of tenancy columns', async () => {
      const { rows } = await db.query(
        `select table_name, column_name from information_schema.columns
          where table_schema = 'market'
            and column_name in ('workspace_id', 'organization_id')`,
      );

      expect(rows).toEqual([]);
    });
  });
});
