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
  let hiddenAttr: string;
  let viewId: string;

  /** seeded as records by beforeAll — the read tests assert on exactly these */
  const CRDS = [910_001, 910_002, 910_003];
  /** created by the write tests; listed only so cleanup can remove them */
  const WRITE_CRDS = [910_004, 910_006, 910_007, 910_008, 910_009];

  const post = (
    path: string,
    body: unknown,
    withAuth = true,
  ): Promise<Response> =>
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

    const mkAttr = async (
      label: string,
      key: string,
      type: string,
      ref: string | null,
    ) => {
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
    tenureAttr = await mkAttr(
      'Tenure',
      'tenure',
      'number',
      'advisor.tenure_months',
    );
    hiddenAttr = await mkAttr('Hidden Note', 'hidden-note', 'text', null);

    const view = await db.query<{ id: string }>(
      `insert into app.entity_view (id, entity_id, workspace_id, name, type, is_default)
       values (gen_random_uuid()::text, $1, $2, 'All Advisors', 'table', true) returning id`,
      [entityId, workspaceId],
    );

    viewId = view.rows[0]?.id as string;

    for (const [i, [attrId, vis]] of (
      [
        [statusAttr, true],
        [tenureAttr, true],
        [hiddenAttr, false],
      ] as [string, boolean][]
    ).entries()) {
      const f = await db.query<{ id: string }>(
        `insert into app.entity_view_field (id, view_id, workspace_id, position, is_visible)
         values (gen_random_uuid()::text, $1, $2, $3, $4) returning id`,
        [viewId, workspaceId, `f${i}`, vis],
      );

      await db.query(
        `insert into app.entity_view_field_path (field_id, position, attribute_id, workspace_id)
         values ($1, 0, $2, $3)`,
        [f.rows[0]?.id, attrId, workspaceId],
      );
    }

    for (const [i, crd] of CRDS.entries()) {
      await db.query(
        `insert into market.advisor (advisor_crd) values ($1) on conflict do nothing`,
        [crd],
      );
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

    await db.query(
      'delete from market.advisor_search where advisor_crd = any($1::bigint[])',
      [allCrds],
    );
    await db.query(
      'delete from market.advisor where advisor_crd = any($1::bigint[])',
      [allCrds],
    );
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
    const body = (await res.json()) as {
      records: { sourceCrd: string }[];
      total: number;
    };

    expect(body.total).toBe(2);
    expect(body.records.map((r) => r.sourceCrd).sort()).toEqual([
      '910002',
      '910003',
    ]);
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
      records: {
        sourceCrd: string;
        cells: { attributeId: string; value: unknown }[];
      }[];
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

    expect(body.records.map((r) => r.sourceCrd)).toEqual([
      '910003',
      '910002',
      '910001',
    ]);
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
    const res = await post('/entities/get-entity-records', {
      entityId,
      limit: 5000,
    });

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
      const a = (await first.json()) as {
        results: { status: string; version: number }[];
      };

      expect(a.results[0]?.status).toBe('written');
      expect(a.results[0]?.version).toBe(0);

      const second = await post('/entities/update-record-values', {
        recordId: id,
        values: [
          { attributeId: statusAttr, value: 'Qualified', expectedVersion: 0 },
        ],
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

    it('rolls back every cell in a batch when one conflicts', async () => {
      const created = await post('/entities/create-entity-record', {
        entityId,
        sourceKind: 'advisor',
        sourceCrd: '910008',
      });
      const { id } = (await created.json()) as { id: string };

      await post('/entities/update-record-values', {
        recordId: id,
        values: [
          { attributeId: statusAttr, value: 'A' },
          { attributeId: hiddenAttr, value: 'h0' },
        ],
      });
      await post('/entities/update-record-values', {
        recordId: id,
        values: [{ attributeId: statusAttr, value: 'B', expectedVersion: 0 }],
      });

      // status would write cleanly at version 1; the stale hidden cell must undo it
      const mixed = await post('/entities/update-record-values', {
        recordId: id,
        values: [
          { attributeId: statusAttr, value: 'C', expectedVersion: 1 },
          { attributeId: hiddenAttr, value: 'h1', expectedVersion: 5 },
        ],
      });

      expect(mixed.status).toBe(409);

      // still at version 1: a committed 'C' would have moved it to 2 and 409ed here
      const after = await post('/entities/update-record-values', {
        recordId: id,
        values: [{ attributeId: statusAttr, value: 'D', expectedVersion: 1 }],
      });
      const body = (await after.json()) as { results: { version: number }[] };

      expect(after.status).toBe(201);
      expect(body.results[0]?.version).toBe(2);

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

  describe('views', () => {
    it('returns the default view and its fields when none is asked for', async () => {
      const res = await post('/entities/get-entity-records', { entityId });
      const body = (await res.json()) as {
        view: {
          id: string;
          isDefault: boolean;
          fields: { label: string; isVisible: boolean }[];
        };
      };

      expect(body.view.id).toBe(viewId);
      expect(body.view.isDefault).toBe(true);
      // every attribute has a field row, hidden or not
      expect(body.view.fields).toHaveLength(3);
      expect(body.view.fields.filter((f) => f.isVisible)).toHaveLength(2);
    });

    it('carries label, icon and type so the grid can render a column', async () => {
      const res = await post('/entities/get-entity-records', { entityId });
      const body = (await res.json()) as {
        view: {
          fields: { label: string; type: string; isEditable: boolean }[];
        };
      };
      const tenure = body.view.fields.find((f) => f.label === 'Tenure');

      expect(tenure?.type).toBe('number');
      // projected from market, so the client renders it read-only
      expect(tenure?.isEditable).toBe(false);
    });

    it('ships no cells for a hidden column', async () => {
      const created = await post('/entities/create-entity-record', {
        entityId,
        sourceKind: 'advisor',
        sourceCrd: '910009',
      });
      const { id } = (await created.json()) as { id: string };

      await post('/entities/update-record-values', {
        recordId: id,
        values: [
          { attributeId: statusAttr, value: 'Visible' },
          { attributeId: hiddenAttr, value: 'Should not ship' },
        ],
      });

      const res = await post('/entities/get-entity-records', { entityId });
      const body = (await res.json()) as {
        records: { sourceCrd: string; cells: { attributeId: string }[] }[];
      };
      const row = body.records.find((r) => r.sourceCrd === '910009');

      expect(row?.cells.map((c) => c.attributeId)).toEqual([statusAttr]);

      await db.query('delete from app.entity_record where id = $1', [id]);
    });

    it('narrows to visibleFieldIds when the client sends them', async () => {
      const first = await post('/entities/get-entity-records', { entityId });
      const view = (
        (await first.json()) as {
          view: { fields: { fieldId: string; label: string }[] };
        }
      ).view;
      const tenureField = view.fields.find(
        (f) => f.label === 'Tenure',
      )?.fieldId;

      const res = await post('/entities/get-entity-records', {
        entityId,
        visibleFieldIds: [tenureField],
      });
      const body = (await res.json()) as { records: { cells: unknown[] }[] };

      // tenure is projected, so narrowing to it means no eav cells at all
      expect(body.records.every((r) => r.cells.length === 0)).toBe(true);
    });

    it('404s for a view id from another entity', async () => {
      const res = await post('/entities/get-entity-records', {
        entityId,
        viewId: '00000000-0000-4000-8000-000000000000',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /entities', () => {
    const get = (withAuth = true) =>
      fetch(`${base}/entities`, { headers: withAuth ? { cookie } : {} });

    it('401s without a session', async () => {
      expect((await get(false)).status).toBe(401);
    });

    it('lists the workspace entities with their views', async () => {
      const body = (await (await get()).json()) as {
        entities: {
          slug: string;
          sourceKind: string | null;
          recordCount: number;
          attributeCount: number;
          views: { isDefault: boolean }[];
        }[];
      };

      // the fixture entity plus the two provisioning seeded
      const advisor = body.entities.find((e) => e.slug === 'e2e-advisor');

      expect(advisor?.sourceKind).toBe('advisor');
      expect(advisor?.recordCount).toBeGreaterThanOrEqual(3);
      expect(advisor?.attributeCount).toBe(3);
      expect(advisor?.views.filter((v) => v.isDefault)).toHaveLength(1);
    });

    it('includes the entities provisioning seeded', async () => {
      const body = (await (await get()).json()) as {
        entities: { slug: string }[];
      };

      expect(body.entities.map((e) => e.slug)).toEqual(
        expect.arrayContaining(['advisor', 'firm']),
      );
    });

    it("never lists another workspace's entities", async () => {
      const body = (await (await get()).json()) as {
        entities: { id: string }[];
      };
      const { rows } = await db.query<{ n: string }>(
        `select count(*)::text as n from app.entity where workspace_id <> $1 and id = any($2::text[])`,
        [workspaceId, body.entities.map((e) => e.id)],
      );

      expect(Number(rows[0]?.n)).toBe(0);
    });
  });
});
