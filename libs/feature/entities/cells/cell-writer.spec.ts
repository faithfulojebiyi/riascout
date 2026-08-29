import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { writeCell, type CellExecutor } from './cell-writer.js';

/**
 * Every case runs against the real table. The interesting behaviour lives in an
 * ON CONFLICT ... WHERE clause, which no mock can faithfully reproduce.
 */
describe('cell writer', () => {
  let db: Client;
  let exec: CellExecutor;

  const ws = '66666666-6666-4666-8666-666666666666';
  const entity = '65656565-6565-4565-8565-656565656565';
  const textAttr = '64646464-6464-4464-8464-646464646464';
  const numAttr = '63636363-6363-4363-8363-636363636363';
  const record = '62626262-6262-4262-8262-626262626262';

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
       values ($1, $2, 'Cells', 'cells-test') on conflict do nothing`,
      [entity, ws],
    );
    await db.query(
      `insert into app.entity_attribute (id, entity_id, workspace_id, label, key, type, position)
       values ($1, $2, $3, 'Status', 'status', 'text', 'a0') on conflict do nothing`,
      [textAttr, entity, ws],
    );
    await db.query(
      `insert into app.entity_attribute (id, entity_id, workspace_id, label, key, type, position)
       values ($1, $2, $3, 'Score', 'score', 'number', 'a1') on conflict do nothing`,
      [numAttr, entity, ws],
    );
    await db.query(
      `insert into app.entity_record (id, entity_id, workspace_id)
       values ($1, $2, $3) on conflict do nothing`,
      [record, entity, ws],
    );
  });

  afterAll(async () => {
    await db.query('delete from app.entity where id = $1', [entity]);
    await db?.end();
  });

  beforeEach(async () => {
    await db.query('delete from app.entity_record_value where record_id = $1', [
      record,
    ]);
  });

  const base = {
    recordId: record,
    workspaceId: ws,
    attributeId: textAttr,
    type: 'text' as const,
    isMultiValue: false,
  };

  const readCell = async (attributeId = textAttr) => {
    const { rows } = await db.query<{
      text_value: string | null;
      numeric_value: string | null;
      source: string | null;
      version: number;
    }>(
      `select text_value, numeric_value, source, version from app.entity_record_value
        where record_id = $1 and attribute_id = $2`,
      [record, attributeId],
    );

    return rows[0];
  };

  it('inserts a new cell at version 0', async () => {
    const result = await writeCell(exec, {
      ...base,
      value: 'Contacted',
      source: null,
    });

    expect(result).toEqual({ status: 'written', version: 0 });
    expect((await readCell())?.text_value).toBe('Contacted');
  });

  it('routes a number to the numeric column', async () => {
    await writeCell(exec, {
      ...base,
      attributeId: numAttr,
      type: 'number',
      value: 42,
      source: null,
    });

    const cell = await readCell(numAttr);

    expect(Number(cell?.numeric_value)).toBe(42);
    expect(cell?.text_value).toBeNull();
  });

  it('bumps version on each update', async () => {
    await writeCell(exec, { ...base, value: 'A', source: null });
    const second = await writeCell(exec, { ...base, value: 'B', source: null });

    expect(second).toEqual({ status: 'written', version: 1 });
    expect((await readCell())?.text_value).toBe('B');
  });

  describe('enrichment never clobbers a manual edit', () => {
    it('skips a machine write over a human-authored cell', async () => {
      await writeCell(exec, { ...base, value: 'Human', source: null });

      const result = await writeCell(exec, {
        ...base,
        value: 'Robot',
        source: 'enrichment',
      });

      expect(result).toEqual({ status: 'skipped', reason: 'manual_edit_wins' });
      expect((await readCell())?.text_value).toBe('Human');
    });

    it('allows a machine write over a machine-authored cell', async () => {
      await writeCell(exec, { ...base, value: 'Old', source: 'enrichment' });

      const result = await writeCell(exec, {
        ...base,
        value: 'New',
        source: 'import',
      });

      expect(result.status).toBe('written');
      expect((await readCell())?.text_value).toBe('New');
    });

    it('allows a human to overwrite a machine-authored cell', async () => {
      await writeCell(exec, { ...base, value: 'Robot', source: 'enrichment' });

      const result = await writeCell(exec, {
        ...base,
        value: 'Human',
        source: null,
      });

      expect(result.status).toBe('written');
      expect((await readCell())?.source).toBeNull();
    });
  });

  describe('optimistic concurrency', () => {
    it('applies a write carrying the current version', async () => {
      await writeCell(exec, { ...base, value: 'A', source: null });

      const result = await writeCell(exec, {
        ...base,
        value: 'B',
        source: null,
        expectedVersion: 0,
      });

      expect(result).toEqual({ status: 'written', version: 1 });
    });

    it('rejects a write carrying a stale version', async () => {
      await writeCell(exec, { ...base, value: 'A', source: null });
      await writeCell(exec, { ...base, value: 'B', source: null });

      const result = await writeCell(exec, {
        ...base,
        value: 'C',
        source: null,
        expectedVersion: 0,
      });

      expect(result).toEqual({ status: 'conflict', actualVersion: 1 });
      expect((await readCell())?.text_value).toBe('B');
    });
  });

  it('clears the previously-populated column when the type changes', async () => {
    await writeCell(exec, {
      ...base,
      attributeId: numAttr,
      type: 'number',
      value: 42,
      source: null,
    });
    await writeCell(exec, {
      ...base,
      attributeId: numAttr,
      type: 'text',
      value: 'now text',
      source: null,
    });

    const cell = await readCell(numAttr);

    expect(cell?.text_value).toBe('now text');
    expect(cell?.numeric_value).toBeNull();
  });

  it('refuses to write a relationship attribute as a cell', async () => {
    await expect(
      writeCell(exec, {
        ...base,
        type: 'relationship',
        value: 'x',
        source: null,
      }),
    ).rejects.toThrow(/stores no cell value/);
  });

  it('writes a null without destroying the row', async () => {
    await writeCell(exec, { ...base, value: 'A', source: null });
    await writeCell(exec, { ...base, value: null, source: null });

    expect((await readCell())?.text_value).toBeNull();
  });
});
