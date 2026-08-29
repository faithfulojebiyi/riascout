import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { writeCell } from './cell-writer.js';
import {
  readCellsForRecords,
  readEdgesForRecords,
  type HydrateExecutor,
} from './page-hydrator.js';

describe('page hydrator', () => {
  let db: Client;
  let exec: HydrateExecutor;

  const ws = '44444444-4444-4444-8444-444444444444';
  const otherWs = '43434343-4343-4343-8343-434343434343';
  const entity = '42424242-4242-4242-8242-424242424242';

  const textAttr = '41414141-4141-4141-8141-414141414141';
  const numAttr = '40404040-4040-4040-8040-404040404040';
  const boolAttr = '39393939-3939-4939-8939-393939393939';
  // paired relationship attributes: employer is canonical, employees is not
  const employerAttr = '38383838-3838-4838-8838-383838383838';
  const employeesAttr = '37373737-3737-4737-8737-373737373737';

  const rec = (n: number): string => `4900000${n}-4444-4444-8444-444444444444`;

  beforeAll(async () => {
    const connectionString = process.env.APP_DATABASE_URL;

    if (!connectionString) {
      throw new Error('APP_DATABASE_URL is required');
    }

    db = new Client({ connectionString });
    await db.connect();
    exec = { query: (sql, params) => db.query(sql, params) as never };

    // workspace_id is a FK to organization.id

    await db.query(
      `insert into app.organization (id, name, slug) values ($1, 'Test WS', $1)

       on conflict do nothing`,

      [ws],
    );

    await db.query(
      `insert into app.entity (id, workspace_id, name, slug)
       values ($1, $2, 'H', 'hydrator-test') on conflict do nothing`,
      [entity, ws],
    );

    const attrs: [string, string, string, string][] = [
      [textAttr, 'Status', 'status', 'text'],
      [numAttr, 'Score', 'score', 'number'],
      [boolAttr, 'Starred', 'starred', 'boolean'],
    ];

    for (const [id, label, key, type] of attrs) {
      await db.query(
        `insert into app.entity_attribute (id, entity_id, workspace_id, label, key, type, position)
         values ($1, $2, $3, $4, $5, $6::"app"."attribute_type", $7) on conflict do nothing`,
        [id, entity, ws, label, key, type, `p${key}`],
      );
    }

    await db.query(
      `insert into app.entity_attribute
         (id, entity_id, workspace_id, label, key, type, position,
          relationship_type, is_canonical_side, other_relationship_side_attribute_id)
       values ($1, $2, $3, 'Employer', 'employer', 'relationship', 'pe',
               'manyToOne', true, $4) on conflict do nothing`,
      [employerAttr, entity, ws, employeesAttr],
    );
    await db.query(
      `insert into app.entity_attribute
         (id, entity_id, workspace_id, label, key, type, position,
          relationship_type, is_canonical_side, other_relationship_side_attribute_id)
       values ($1, $2, $3, 'Employees', 'employees', 'relationship', 'pf',
               'oneToMany', false, $4) on conflict do nothing`,
      [employeesAttr, entity, ws, employerAttr],
    );

    for (const n of [1, 2, 3]) {
      await db.query(
        `insert into app.entity_record (id, entity_id, workspace_id)
         values ($1, $2, $3) on conflict do nothing`,
        [rec(n), entity, ws],
      );
    }

    await writeCell(exec as never, {
      recordId: rec(1),
      attributeId: textAttr,
      workspaceId: ws,
      type: 'text',
      isMultiValue: false,
      value: 'Contacted',
      source: null,
    });
    await writeCell(exec as never, {
      recordId: rec(1),
      attributeId: numAttr,
      workspaceId: ws,
      type: 'number',
      isMultiValue: false,
      value: 87.5,
      source: 'enrichment',
    });
    await writeCell(exec as never, {
      recordId: rec(2),
      attributeId: boolAttr,
      workspaceId: ws,
      type: 'boolean',
      isMultiValue: false,
      value: true,
      source: null,
    });

    // records 1 and 2 both report to record 3
    for (const n of [1, 2]) {
      await db.query(
        `insert into app.entity_record_relationship
           (id, source_record_id, target_record_id, attribute_id, workspace_id, relationship_type)
         values (gen_random_uuid(), $1, $2, $3, $4, 'manyToOne') on conflict do nothing`,
        [rec(n), rec(3), employerAttr, ws],
      );
    }
  });

  afterAll(async () => {
    await db.query('delete from app.entity where id = $1', [entity]);
    await db?.end();
  });

  describe('readCellsForRecords', () => {
    it('returns nothing for an empty page without querying', async () => {
      await expect(readCellsForRecords(exec, [], ws)).resolves.toEqual(
        new Map(),
      );
    });

    it('picks the typed column matching each attribute type', async () => {
      const cells = await readCellsForRecords(exec, [rec(1), rec(2)], ws);

      const first = cells.get(rec(1)) ?? [];

      expect(first.find((c) => c.attributeId === textAttr)?.value).toBe(
        'Contacted',
      );
      expect(first.find((c) => c.attributeId === numAttr)?.value).toBe(87.5);
      expect(cells.get(rec(2))?.[0]?.value).toBe(true);
    });

    it('returns a number, not a numeric string', async () => {
      const cells = await readCellsForRecords(exec, [rec(1)], ws);
      const score = (cells.get(rec(1)) ?? []).find(
        (c) => c.attributeId === numAttr,
      );

      expect(typeof score?.value).toBe('number');
    });

    it('exposes source and version so the client can round-trip an edit', async () => {
      const cells = await readCellsForRecords(exec, [rec(1)], ws);
      const list = cells.get(rec(1)) ?? [];

      expect(list.find((c) => c.attributeId === textAttr)?.source).toBeNull();
      expect(list.find((c) => c.attributeId === numAttr)?.source).toBe(
        'enrichment',
      );
      expect(list.every((c) => typeof c.version === 'number')).toBe(true);
    });

    it('omits records with no cells rather than inventing empties', async () => {
      const cells = await readCellsForRecords(exec, [rec(3)], ws);

      expect(cells.has(rec(3))).toBe(false);
    });

    it('never crosses a workspace boundary', async () => {
      await expect(
        readCellsForRecords(exec, [rec(1)], otherWs),
      ).resolves.toEqual(new Map());
    });
  });

  describe('readEdgesForRecords', () => {
    it('reads the canonical side directly', async () => {
      const edges = await readEdgesForRecords(exec, [rec(1)], ws);

      expect(edges.get(rec(1))).toEqual([
        { attributeId: employerAttr, targetIds: [rec(3)] },
      ]);
    });

    it('re-keys the inverse side to the paired attribute', async () => {
      const edges = await readEdgesForRecords(exec, [rec(3)], ws);
      const entry = edges.get(rec(3))?.[0];

      expect(entry?.attributeId).toBe(employeesAttr);
      expect(entry?.targetIds.sort()).toEqual([rec(1), rec(2)].sort());
    });

    it('groups both directions in one pass', async () => {
      const edges = await readEdgesForRecords(
        exec,
        [rec(1), rec(2), rec(3)],
        ws,
      );

      expect(edges.size).toBe(3);
    });

    it('returns nothing for an empty page', async () => {
      await expect(readEdgesForRecords(exec, [], ws)).resolves.toEqual(
        new Map(),
      );
    });

    it('never crosses a workspace boundary', async () => {
      await expect(
        readEdgesForRecords(exec, [rec(1)], otherWs),
      ).resolves.toEqual(new Map());
    });
  });
});
