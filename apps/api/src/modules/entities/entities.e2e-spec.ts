import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Exercises the real HTTP surface: guard, ALS, compiler, market join and
 * hydration. The unit tests prove each piece; this proves they are wired.
 */
describe('POST /entities/get-entity-records', () => {
  const base = `http://localhost:${process.env.PORT ?? 3320}`;
  /** better-auth rejects state-changing calls without a trusted Origin */
  const origin = { origin: base };
  const email = `entities-e2e-${Date.now()}@example.test`;
  const password = 'correct-horse-battery-staple';

  let db: Client;
  let cookie: string;
  let workspaceId: string;
  let entityId: string;
  let statusAttr: string;
  let tenureAttr: string;

    /** seeded as records by beforeAll — the read tests assert on exactly these */
  const CRDS = [910_001, 910_002, 910_003];
  /** created by the write tests; listed only so cleanup can remove them */
  const WRITE_CRDS = [910_004, 910_006, 910_007, 910_008];

  const post = (path: string, body: unknown, withAuth = true): Promise<Response> =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(withAuth ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });

  beforeAll(async () => {
    db = new Client({ connectionString: process.env.APP_DATABASE_URL });
    await db.connect();

    const signUp = await fetch(`${base}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...origin },
      body: JSON.stringify({ email, password, name: 'E2E' }),
    });

    cookie = signUp.headers.get('set-cookie') ?? '';

    const org = await fetch(`${base}/api/auth/organization/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, ...origin },
      body: JSON.stringify({ name: 'E2E WS', slug: `e2e-${Date.now()}` }),
    });

    const orgBody = (await org.json()) as { id?: string; message?: string };

    if (!orgBody.id) {
      throw new Error(`organization/create failed: ${JSON.stringify(orgBody)}`);
    }

    workspaceId = orgBody.id;

    await fetch(`${base}/api/auth/organization/set-active`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, ...origin },
      body: JSON.stringify({ organizationId: workspaceId }),
    });

    const entity = await db.query<{ id: string }>(
      `insert into app.entity (id, workspace_id, name, slug, source_kind)
       values (gen_random_uuid()::text, $1, 'Advisor', 'e2e-advisor', 'advisor')
       returning id`,
      [workspaceId],
    );

    entityId = entity.rows[0]?.id as string;

    const mkAttr = async (label: string, key: string, type: string, ref: string | null) => {
      const { rows } = await db.query<{ id: string }>(
        `insert into app.entity_attribute
           (id, entity_id, workspace_id, label, key, type, position, reference_column, is_editable)
         values (gen_random_uuid()::text, $1, $2, $3, $4, $5::"app"."attribute_type", $6, $7, $8)
         returning id`,
        [entityId, workspaceId, label, key, type, key, ref, ref === null],
      );

      return rows[0]?.id as string;
    };

    statusAttr = await mkAttr('Status', 'status', 'text', null);
    tenureAttr = await mkAttr('Tenure', 'tenure', 'number', 'advisor.tenure_months');

    for (const [i, crd] of CRDS.entries()) {
      await db.query(`insert into market.advisor (advisor_crd) values ($1) on conflict do nothing`, [
        crd,
      ]);
      await db.query(
        `insert into market.advisor_search (advisor_crd, full_name, tenure_months, disclosure_status)
         values ($1, $2, $3, 'none_reported')
         on conflict (advisor_crd) do update set tenure_months = excluded.tenure_months`,
        [crd, `Advisor ${crd}`, (i + 1) * 60],
      );

      const rec = await db.query<{ id: string }>(
        `insert into app.entity_record (id, entity_id, workspace_id, source_kind, source_crd)
         values (gen_random_uuid()::text, $1, $2, 'advisor', $3) returning id`,
        [entityId, workspaceId, crd],
      );

      if (i === 0) {
        await db.query(
          `insert into app.entity_record_value
             (id, record_id, attribute_id, workspace_id, text_value)
           values (gen_random_uuid()::text, $1, $2, $3, 'Contacted')`,
          [rec.rows[0]?.id, statusAttr, workspaceId],
        );
      }
    }
  });

  afterAll(async () => {
    await db.query('delete from app.organization where id = $1', [workspaceId]);
    await db.query('delete from app."user" where email = $1', [email]);
    const allCrds = [...CRDS, ...WRITE_CRDS];

    await db.query('delete from market.advisor_search where advisor_crd = any($1::bigint[])', [
      allCrds,
    ]);
    await db.query('delete from market.advisor where advisor_crd = any($1::bigint[])', [allCrds]);
    await db.end();
  });

  it('401s without a session', async () => {
    const res = await post('/entities/get-entity-records', { entityId }, false);

    expect(res.status).toBe(401);
  });

  it('returns every record for the workspace', async () => {
    const res = await post('/entities/get-entity-records', { entityId });
    const body = (await res.json()) as { records: unknown[]; total: number };

    expect(res.status).toBe(201);
    expect(body.total).toBe(3);
    expect(body.records).toHaveLength(3);
  });

  it('filters on a projected market column', async () => {
    const res = await post('/entities/get-entity-records', {
      entityId,
      filter: {
        kind: 'condition',
        path: [{ attributeId: tenureAttr }],
        operator: 'isGreaterThan',
        value: 100,
      },
    });
    const body = (await res.json()) as { records: { sourceCrd: string }[]; total: number };

    expect(body.total).toBe(2);
    expect(body.records.map((r) => r.sourceCrd).sort()).toEqual(['910002', '910003']);
  });

  it('filters on a user-authored cell and hydrates it', async () => {
    const res = await post('/entities/get-entity-records', {
      entityId,
      filter: {
        kind: 'condition',
        path: [{ attributeId: statusAttr }],
        operator: 'is',
        value: 'Contacted',
      },
    });
    const body = (await res.json()) as {
      records: { sourceCrd: string; cells: { attributeId: string; value: unknown }[] }[];
    };

    expect(body.records).toHaveLength(1);
    expect(body.records[0]?.sourceCrd).toBe('910001');
    expect(body.records[0]?.cells[0]?.value).toBe('Contacted');
  });

  it('sorts by a projected column', async () => {
    const res = await post('/entities/get-entity-records', {
      entityId,
      sort: [{ path: [{ attributeId: tenureAttr }], direction: 'desc' }],
    });
    const body = (await res.json()) as { records: { sourceCrd: string }[] };

    expect(body.records.map((r) => r.sourceCrd)).toEqual(['910003', '910002', '910001']);
  });

  it('rejects a malformed filter tree with a 400', async () => {
    const res = await post('/entities/get-entity-records', {
      entityId,
      filter: { kind: 'nonsense' },
    });

    expect(res.status).toBe(400);
  });

  it('404s for an entity in another workspace', async () => {
    const other = await db.query<{ id: string }>(
      `insert into app.organization (id, name, slug)
       values (gen_random_uuid()::text, 'Other', $1) returning id`,
      [`other-${Date.now()}`],
    );
    const otherWs = other.rows[0]?.id as string;
    const otherEntity = await db.query<{ id: string }>(
      `insert into app.entity (id, workspace_id, name, slug)
       values (gen_random_uuid()::text, $1, 'X', 'x') returning id`,
      [otherWs],
    );

    const res = await post('/entities/get-entity-records', {
      entityId: otherEntity.rows[0]?.id,
    });

    expect(res.status).toBe(404);
    await db.query('delete from app.organization where id = $1', [otherWs]);
  });

  it('caps the page size', async () => {
    const res = await post('/entities/get-entity-records', { entityId, limit: 5000 });

    expect(res.status).toBe(400);
  });

  describe('writes', () => {
    it('creates a record and is idempotent on the same CRD', async () => {
      const body = { entityId, sourceKind: 'advisor', sourceCrd: '910004' };

      const first = await post('/entities/create-entity-record', body);
      const a = (await first.json()) as { id: string; created: boolean };

      expect(a.created).toBe(true);

      const second = await post('/entities/create-entity-record', body);
      const b = (await second.json()) as { id: string; created: boolean };

      // re-saving from search must not create a duplicate pipeline record
      expect(b.created).toBe(false);
      expect(b.id).toBe(a.id);

      await db.query('delete from app.entity_record where id = $1', [a.id]);
    });

    it('rejects a sourceCrd without a sourceKind', async () => {
      const res = await post('/entities/create-entity-record', {
        entityId,
        sourceCrd: '910005',
      });

      expect(res.status).toBe(400);
    });

    it('writes a cell and bumps its version', async () => {
      const created = await post('/entities/create-entity-record', {
        entityId,
        sourceKind: 'advisor',
        sourceCrd: '910006',
      });
      const { id } = (await created.json()) as { id: string };

      const first = await post('/entities/update-record-values', {
        recordId: id,
        values: [{ attributeId: statusAttr, value: 'Contacted' }],
      });
      const a = (await first.json()) as { results: { status: string; version: number }[] };

      expect(a.results[0]?.status).toBe('written');
      expect(a.results[0]?.version).toBe(0);

      const second = await post('/entities/update-record-values', {
        recordId: id,
        values: [{ attributeId: statusAttr, value: 'Qualified', expectedVersion: 0 }],
      });
      const b = (await second.json()) as { results: { version: number }[] };

      expect(b.results[0]?.version).toBe(1);

      await db.query('delete from app.entity_record where id = $1', [id]);
    });

    it('409s on a stale expectedVersion', async () => {
      const created = await post('/entities/create-entity-record', {
        entityId,
        sourceKind: 'advisor',
        sourceCrd: '910007',
      });
      const { id } = (await created.json()) as { id: string };

      await post('/entities/update-record-values', {
        recordId: id,
        values: [{ attributeId: statusAttr, value: 'A' }],
      });
      await post('/entities/update-record-values', {
        recordId: id,
        values: [{ attributeId: statusAttr, value: 'B' }],
      });

      const stale = await post('/entities/update-record-values', {
        recordId: id,
        values: [{ attributeId: statusAttr, value: 'C', expectedVersion: 0 }],
      });

      expect(stale.status).toBe(409);

      await db.query('delete from app.entity_record where id = $1', [id]);
    });

    it('refuses to write a projected market column', async () => {
      const created = await post('/entities/create-entity-record', {
        entityId,
        sourceKind: 'advisor',
        sourceCrd: '910008',
      });
      const { id } = (await created.json()) as { id: string };

      const res = await post('/entities/update-record-values', {
        recordId: id,
        values: [{ attributeId: tenureAttr, value: 999 }],
      });

      expect(res.status).toBe(403);

      await db.query('delete from app.entity_record where id = $1', [id]);
    });

    it('404s writing to a record in another workspace', async () => {
      const res = await post('/entities/update-record-values', {
        recordId: '00000000-0000-4000-8000-000000000000',
        values: [{ attributeId: statusAttr, value: 'X' }],
      });

      expect(res.status).toBe(404);
    });
  });
});
