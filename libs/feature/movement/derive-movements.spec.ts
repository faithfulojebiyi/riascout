import { readFileSync } from 'node:fs';

import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Movement is the diff between two complete collections, so every case here is
 * a sequence of runs rather than a single end state. Runs are identified by
 * collection_id, never by date — two collections can complete on one day.
 */
describe('movement derivation', () => {
  let db: Client;
  let sql: string;

  const A = 800_001;
  const FIRM_X = 800_101;
  const FIRM_Y = 800_102;
  const FIRM_Z = 800_103;

  /** every test builds its runs from this prefix so cleanup is exact */
  const RUN = (n: string): string => `test-run-${n}`;

  beforeAll(async () => {
    const connectionString = process.env.APP_DATABASE_URL;

    if (!connectionString) {
      throw new Error('APP_DATABASE_URL is required');
    }

    db = new Client({ connectionString });
    await db.connect();

    sql = readFileSync('libs/feature/movement/derive-movements.sql', 'utf8');

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
    await db.query(
      "delete from market.observation_run where collection_id like 'test-run-%'",
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
    await db.query(
      "delete from market.observation_run where collection_id like 'test-run-%'",
    );
  });

  /**
   * A collection: complete unless told otherwise. completed_at defaults to the
   * observed date but can be set independently — chronology is the timestamp,
   * never the id.
   */
  const run = (
    id: string,
    observedOn: string,
    isComplete = true,
    completedAt?: string,
  ): Promise<unknown> =>
    db.query(
      `insert into market.observation_run
         (collection_id, source_code, observed_on, completed_at, is_complete)
       values ($1, 'test', $2::date, $3::timestamptz, $4)`,
      [RUN(id), observedOn, completedAt ?? observedOn, isComplete],
    );

  /**
   * business-allowed by default; status drives can_conduct_business the way
   * dim_registration_status does in production
   */
  const observe = (
    id: string,
    observedOn: string,
    firmCrd: number | null,
    opts: { canConduct?: boolean; jurisdiction?: string } = {},
  ): Promise<unknown> =>
    db.query(
      `insert into market.advisor_firm_observation
         (advisor_crd, observed_on, firm_crd, jurisdiction, collection_id,
          source_code, registration_current, can_conduct_business)
       values ($1, $2, $3, $4, $5, 'test', true, $6)`,
      [
        A,
        observedOn,
        firmCrd,
        opts.jurisdiction ?? null,
        RUN(id),
        firmCrd === null ? false : (opts.canConduct ?? true),
      ],
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

  const derive = async (id: string): Promise<number> => {
    const { rows } = await db.query<{ movements_created: number }>(sql, [
      RUN(id),
    ]);

    return Number(rows[0]?.movements_created ?? 0);
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
              occurred_on::text as occurred_on, detected_on::text as detected_on,
              tenure_days
         from market.advisor_movement where advisor_crd = $1
        order by detected_on, id`,
      [A],
    );

    return rows;
  };

  const runState = async (id: string) => {
    const { rows } = await db.query<{
      movement_status: string;
      movement_count: number | null;
      movement_processed_at: string | null;
    }>(
      `select movement_status, movement_count, movement_processed_at
         from market.observation_run where collection_id = $1`,
      [RUN(id)],
    );

    return rows[0];
  };

  it('treats the first complete run as a baseline with no movement', async () => {
    await run('1', '2024-01-01');
    await observe('1', '2024-01-01', FIRM_X);
    await register(FIRM_X, '2023-12-01', null);

    expect(await derive('1')).toBe(0);
    expect(await movements()).toHaveLength(0);

    // processed with zero movements is a real state, not a failure
    const state = await runState('1');

    expect(state?.movement_status).toBe('processed');
    expect(state?.movement_count).toBe(0);
    expect(state?.movement_processed_at).not.toBeNull();
  });

  it('records a first registration when the adviser had no firm before', async () => {
    await run('1', '2024-01-01');
    await observe('1', '2024-01-01', null);
    await run('2', '2024-02-01');
    await observe('2', '2024-02-01', FIRM_X);
    await register(FIRM_X, '2024-01-20', null);

    await derive('1');

    expect(await derive('2')).toBe(1);

    const [m] = await movements();

    expect(m?.event_type).toBe('FIRST_REGISTRATION');
    expect(m?.from_firm_crd).toBeNull();
    expect(Number(m?.to_firm_crd)).toBe(FIRM_X);
  });

  it('records a firm change between two runs', async () => {
    await run('1', '2024-01-01');
    await observe('1', '2024-01-01', FIRM_X);
    await run('2', '2024-02-01');
    await observe('2', '2024-02-01', FIRM_Y);
    await register(FIRM_X, '2023-01-01', '2024-01-15');
    await register(FIRM_Y, '2024-01-15', null);

    await derive('1');
    await derive('2');

    const [change] = await movements();

    expect(change?.event_type).toBe('FIRM_CHANGE');
    expect(Number(change?.from_firm_crd)).toBe(FIRM_X);
    expect(Number(change?.to_firm_crd)).toBe(FIRM_Y);
  });

  it('represents a null-firm snapshot as a DEPARTURE', async () => {
    await run('1', '2024-01-01');
    await observe('1', '2024-01-01', FIRM_X);
    await run('2', '2024-02-01');
    await observe('2', '2024-02-01', null);
    await register(FIRM_X, '2023-01-01', '2024-01-20');

    await derive('1');
    await derive('2');

    const departure = (await movements()).at(-1);

    expect(departure?.event_type).toBe('DEPARTURE');
    expect(Number(departure?.from_firm_crd)).toBe(FIRM_X);
    expect(departure?.to_firm_crd).toBeNull();
  });

  it('keeps know time separate from valid time', async () => {
    await run('1', '2024-01-01');
    await observe('1', '2024-01-01', null);
    await run('2', '2024-03-15');
    await observe('2', '2024-03-15', FIRM_X);
    await register(FIRM_X, '2024-01-02', null);

    await derive('1');
    await derive('2');

    const [m] = await movements();

    // occurred 2 Jan, detected 15 Mar — the latency is the product
    expect(m?.occurred_on).toBe('2024-01-02');
    expect(m?.detected_on).toBe('2024-03-15');
  });

  it('leaves occurred_on NULL when only an observation supports the move', async () => {
    await run('1', '2024-01-01');
    await observe('1', '2024-01-01', FIRM_X);
    await run('2', '2024-02-01');
    await observe('2', '2024-02-01', FIRM_Y);
    // an OLD CLOSED stint at Y: its start date must never date this move
    await register(FIRM_X, '2023-01-01', '2024-01-15');
    await register(FIRM_Y, '2015-01-01', '2016-01-01');

    await derive('1');
    await derive('2');

    const [m] = await movements();

    expect(m?.event_type).toBe('FIRM_CHANGE');
    expect(m?.occurred_on).toBeNull();
    expect(m?.tenure_days).toBeNull();
  });

  it('ignores an incomplete run', async () => {
    await run('1', '2024-01-01');
    await observe('1', '2024-01-01', FIRM_X);
    await run('2', '2024-02-01', false);
    await observe('2', '2024-02-01', FIRM_Y);
    await register(FIRM_Y, '2024-01-15', null);

    await derive('1');

    expect(await derive('2')).toBe(0);
    expect(await movements()).toHaveLength(0);

    // and it is NOT marked processed — it was never diffable
    expect((await runState('2'))?.movement_status).toBe('pending');
  });

  /**
   * The ids sort the opposite way to the clock on purpose: 'a-second' precedes
   * 'z-first' alphabetically but completed eight hours later. Ordering by id
   * would pick the wrong predecessor and this would derive nothing.
   */
  it('orders two same-date runs by completed_at, not by collection_id', async () => {
    await run('z-first', '2024-01-01', true, '2024-01-01T09:00:00Z');
    await observe('z-first', '2024-01-01', FIRM_X);
    await run('a-second', '2024-01-01', true, '2024-01-01T17:00:00Z');
    await observe('a-second', '2024-01-01', FIRM_Y);
    await register(FIRM_X, '2023-01-01', '2024-01-01');
    await register(FIRM_Y, '2024-01-01', null);

    // the chronologically first run is the baseline
    expect(await derive('z-first')).toBe(0);

    expect(await derive('a-second')).toBe(1);

    const [m] = await movements();

    expect(m?.event_type).toBe('FIRM_CHANGE');
    expect(Number(m?.from_firm_crd)).toBe(FIRM_X);
    expect(Number(m?.to_firm_crd)).toBe(FIRM_Y);
  });

  /** the same reversal, but proving the earlier run finds no predecessor */
  it('gives the chronologically earliest run no predecessor despite its id', async () => {
    await run('z-first', '2024-01-01', true, '2024-01-01T09:00:00Z');
    await observe('z-first', '2024-01-01', FIRM_X);
    await run('a-second', '2024-01-01', true, '2024-01-01T17:00:00Z');
    await observe('a-second', '2024-01-01', FIRM_Y);
    await register(FIRM_X, '2023-01-01', null);

    // deriving the later one first must not make the earlier one diffable
    await derive('a-second');

    expect(await derive('z-first')).toBe(0);

    const state = await runState('z-first');

    expect(state?.movement_status).toBe('processed');
    expect(state?.movement_count).toBe(0);
  });

  it('ignores SUSPENSION and REQUAL when choosing the primary firm', async () => {
    await run('1', '2024-01-01');
    await observe('1', '2024-01-01', FIRM_X);
    await run('2', '2024-02-01');
    // still permitted at X; a non-permitted row at Y must not win
    await observe('2', '2024-02-01', FIRM_X);
    await observe('2', '2024-02-01', FIRM_Y, { canConduct: false });
    await register(FIRM_X, '2020-01-01', null);
    await register(FIRM_Y, '2024-01-15', null);

    await derive('1');

    expect(await derive('2')).toBe(0);
    expect(await movements()).toHaveLength(0);
  });

  it('does not invent an event for an adviser absent from both runs', async () => {
    await run('1', '2024-01-01');
    await observe('1', '2024-01-01', null);
    await run('2', '2024-02-01');
    await observe('2', '2024-02-01', null);

    await derive('1');

    expect(await derive('2')).toBe(0);
    expect(await movements()).toHaveLength(0);
  });

  it('processes a second run with zero movement and still marks it ready', async () => {
    await run('1', '2024-01-01');
    await observe('1', '2024-01-01', FIRM_X);
    await run('2', '2024-02-01');
    await observe('2', '2024-02-01', FIRM_X);
    await register(FIRM_X, '2023-12-01', null);

    await derive('1');

    expect(await derive('2')).toBe(0);

    const state = await runState('2');

    // zero movements, but processed — "nothing moved", not "never ran"
    expect(state?.movement_status).toBe('processed');
    expect(state?.movement_count).toBe(0);
    expect(state?.movement_processed_at).not.toBeNull();
  });

  it('is idempotent: reprocessing a run derives nothing new', async () => {
    await run('1', '2024-01-01');
    await observe('1', '2024-01-01', null);
    await run('2', '2024-02-01');
    await observe('2', '2024-02-01', FIRM_X);
    await register(FIRM_X, '2024-01-20', null);

    await derive('1');

    expect(await derive('2')).toBe(1);
    expect(await derive('2')).toBe(0);
    expect(await movements()).toHaveLength(1);
  });

  it('collapses concurrent registrations to the earliest-joined firm', async () => {
    await run('1', '2024-01-01');
    await observe('1', '2024-01-01', null);
    await run('2', '2024-02-01');
    await observe('2', '2024-02-01', FIRM_X, { jurisdiction: 'IN' });
    await observe('2', '2024-02-01', FIRM_Z, { jurisdiction: 'OH' });
    await register(FIRM_X, '2020-01-01', null);
    await register(FIRM_Z, '2023-06-01', null);

    await derive('1');

    expect(await derive('2')).toBe(1);

    const [m] = await movements();

    expect(Number(m?.to_firm_crd)).toBe(FIRM_X);
  });

  it('records a return to a former firm', async () => {
    await run('1', '2024-01-01');
    await observe('1', '2024-01-01', FIRM_X);
    await run('2', '2024-02-01');
    await observe('2', '2024-02-01', FIRM_Y);
    await run('3', '2024-03-01');
    await observe('3', '2024-03-01', FIRM_X);
    await register(FIRM_X, '2023-01-01', '2024-01-15');
    await register(FIRM_Y, '2024-01-15', '2024-02-20');
    await register(FIRM_X, '2024-02-20', null);

    await derive('1');
    await derive('2');
    await derive('3');

    const all = await movements();

    expect(all.map((m) => m.event_type)).toEqual([
      'FIRM_CHANGE',
      'FIRM_CHANGE',
    ]);
    expect(Number(all.at(-1)?.to_firm_crd)).toBe(FIRM_X);
  });
});
