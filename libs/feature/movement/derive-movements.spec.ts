import { readFileSync } from 'node:fs';

import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Movement is the diff between successive observations, so every case here is
 * expressed as a sequence of snapshots rather than a single end state.
 */
describe('movement derivation', () => {
  let db: Client;
  let sql: string;

  const A = 800_001;
  const FIRM_X = 800_101;
  const FIRM_Y = 800_102;
  const FIRM_Z = 800_103;

  beforeAll(async () => {
    const connectionString = process.env.APP_DATABASE_URL;

    if (!connectionString) {
      throw new Error('APP_DATABASE_URL is required');
    }

    db = new Client({ connectionString });
    await db.connect();

    // strip the TypedSQL @param header; the file is parameterised positionally
    sql = readFileSync('prisma/sql/deriveMovements.sql', 'utf8');

    await db.query(`insert into market.dim_source (code, name, category)
                    values ('test', 'Test', 'internal') on conflict do nothing`);
    await db.query(
      `insert into market.advisor (advisor_crd) values ($1)
                    on conflict do nothing`,
      [A],
    );
    await db.query(
      `insert into market.firm (firm_crd) values ($1),($2),($3)
                    on conflict do nothing`,
      [FIRM_X, FIRM_Y, FIRM_Z],
    );
  });

  afterAll(async () => {
    await db.query('delete from market.advisor where advisor_crd = $1', [A]);
    await db.query(
      'delete from market.firm where firm_crd = any($1::bigint[])',
      [[FIRM_X, FIRM_Y, FIRM_Z]],
    );
    await db?.end();
  });

  beforeEach(async () => {
    await db.query(
      'delete from market.advisor_movement where advisor_crd = $1',
      [A],
    );
    await db.query(
      'delete from market.advisor_firm_observation where advisor_crd = $1',
      [A],
    );
    await db.query(
      'delete from market.advisor_registration where advisor_crd = $1',
      [A],
    );
  });

  const observe = (
    observedOn: string,
    firmCrd: number | null,
  ): Promise<unknown> =>
    db.query(
      `insert into market.advisor_firm_observation
         (advisor_crd, observed_on, firm_crd, source_code)
       values ($1, $2, $3, 'test')`,
      [A, observedOn, firmCrd],
    );

  const register = (
    firmCrd: number,
    start: string,
    end: string | null,
  ): Promise<unknown> =>
    db.query(
      `insert into market.advisor_registration
         (advisor_crd, employer_firm_crd, jurisdiction, start_date, end_date)
       values ($1, $2, 'IN', $3, $4)`,
      [A, firmCrd, start, end],
    );

  const derive = async (observedOn: string): Promise<number> => {
    const { rows } = await db.query(sql, [observedOn]);

    return rows.length;
  };

  const movements = async () => {
    const { rows } = await db.query<{
      event_type: string;
      from_firm_crd: string | null;
      to_firm_crd: string | null;
      occurred_on: string | null;
      detected_on: string;
      tenure_days: number | null;
    }>(
      `select event_type, from_firm_crd, to_firm_crd,
              occurred_on::text as occurred_on, detected_on::text as detected_on, tenure_days
         from market.advisor_movement where advisor_crd = $1 order by detected_on, id`,
      [A],
    );

    return rows;
  };

  it('records a first registration with no origin firm', async () => {
    await observe('2024-01-01', FIRM_X);
    await register(FIRM_X, '2023-12-01', null);

    expect(await derive('2024-01-01')).toBe(1);

    const [m] = await movements();

    expect(m?.event_type).toBe('FIRST_REGISTRATION');
    expect(m?.from_firm_crd).toBeNull();
    expect(Number(m?.to_firm_crd)).toBe(FIRM_X);
  });

  it('records a firm change between two snapshots', async () => {
    await observe('2024-01-01', FIRM_X);
    await observe('2024-02-01', FIRM_Y);
    await register(FIRM_X, '2023-01-01', '2024-01-15');
    await register(FIRM_Y, '2024-01-15', null);

    await derive('2024-01-01');
    await derive('2024-02-01');

    const [, change] = await movements();

    expect(change?.event_type).toBe('FIRM_CHANGE');
    expect(Number(change?.from_firm_crd)).toBe(FIRM_X);
    expect(Number(change?.to_firm_crd)).toBe(FIRM_Y);
  });

  it('represents leaving the industry as a DEPARTURE', async () => {
    await observe('2024-01-01', FIRM_X);
    await observe('2024-02-01', null);
    await register(FIRM_X, '2023-01-01', '2024-01-20');

    await derive('2024-01-01');
    await derive('2024-02-01');

    const departure = (await movements()).at(-1);

    expect(departure?.event_type).toBe('DEPARTURE');
    expect(Number(departure?.from_firm_crd)).toBe(FIRM_X);
    expect(departure?.to_firm_crd).toBeNull();
  });

  it('keeps know time separate from valid time', async () => {
    await observe('2024-03-15', FIRM_X);
    await register(FIRM_X, '2024-01-02', null);

    await derive('2024-03-15');

    const [m] = await movements();

    // occurred 2 Jan, detected 15 Mar — the latency is the product
    expect(m?.occurred_on).toBe('2024-01-02');
    expect(m?.detected_on).toBe('2024-03-15');
  });

  it('computes tenure days from the previous firm', async () => {
    await observe('2024-01-01', FIRM_X);
    await observe('2024-02-01', FIRM_Y);
    await register(FIRM_X, '2023-01-01', '2024-01-15');
    await register(FIRM_Y, '2024-01-31', null);

    await derive('2024-01-01');
    await derive('2024-02-01');

    const change = (await movements()).at(-1);

    // 2023-01-01 -> 2024-01-31
    expect(change?.tenure_days).toBe(395);
  });

  it('is append-only: re-running derives nothing new', async () => {
    await observe('2024-01-01', FIRM_X);
    await register(FIRM_X, '2023-12-01', null);

    expect(await derive('2024-01-01')).toBe(1);
    expect(await derive('2024-01-01')).toBe(0);
    expect(await movements()).toHaveLength(1);
  });

  it('ignores a snapshot where the firm did not change', async () => {
    await observe('2024-01-01', FIRM_X);
    await observe('2024-02-01', FIRM_X);
    await register(FIRM_X, '2023-12-01', null);

    await derive('2024-01-01');

    expect(await derive('2024-02-01')).toBe(0);
    expect(await movements()).toHaveLength(1);
  });

  it('records a return to a former firm', async () => {
    await observe('2024-01-01', FIRM_X);
    await observe('2024-02-01', FIRM_Y);
    await observe('2024-03-01', FIRM_X);
    await register(FIRM_X, '2023-01-01', '2024-01-15');
    await register(FIRM_Y, '2024-01-15', '2024-02-20');
    await register(FIRM_X, '2024-02-20', null);

    await derive('2024-01-01');
    await derive('2024-02-01');
    await derive('2024-03-01');

    const all = await movements();

    expect(all.map((m) => m.event_type)).toEqual([
      'FIRST_REGISTRATION',
      'FIRM_CHANGE',
      'FIRM_CHANGE',
    ]);
    expect(Number(all.at(-1)?.to_firm_crd)).toBe(FIRM_X);
  });

  it('collapses concurrent registrations to the earliest-joined firm', async () => {
    // dual registration on the same day; without collapsing, lag() is
    // non-deterministic and would emit a spurious FIRM_CHANGE
    await observe('2024-01-01', FIRM_X);
    await observe('2024-01-01', FIRM_Z);
    await register(FIRM_X, '2020-01-01', null);
    await register(FIRM_Z, '2023-06-01', null);

    expect(await derive('2024-01-01')).toBe(1);

    const [m] = await movements();

    expect(Number(m?.to_firm_crd)).toBe(FIRM_X);
  });

  it('does not invent a first registration for an advisor never seen at a firm', async () => {
    await observe('2024-01-01', null);

    expect(await derive('2024-01-01')).toBe(0);
    expect(await movements()).toHaveLength(0);
  });

  it('derives only the requested snapshot', async () => {
    await observe('2024-01-01', FIRM_X);
    await observe('2024-02-01', FIRM_Y);
    await register(FIRM_X, '2023-01-01', '2024-01-15');
    await register(FIRM_Y, '2024-01-15', null);

    expect(await derive('2024-02-01')).toBe(1);
    expect((await movements())[0]?.event_type).toBe('FIRM_CHANGE');
  });
});
