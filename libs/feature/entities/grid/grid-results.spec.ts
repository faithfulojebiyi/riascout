import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { writeCell, type CellExecutor } from '../cells/cell-writer.js';
import type { FilterTree, SortAst } from '../filter-sort/ast.js';
import type { AttributeMeta } from '../relationship-edges.js';
import {
  buildGridCountQuery,
  buildGridPageQuery,
} from './grid-query.builder.js';

/**
 * The other grid spec proves the SQL is legal. This proves it is correct:
 * real records, real cells, real market rows, asserting which ids come back.
 */
describe('grid results', () => {
  let db: Client;
  let exec: CellExecutor;

  const ws = '55555555-5555-4555-8555-555555555555';
  const entity = '54545454-5454-4454-8454-545454545454';
  const statusAttr = '53535353-5353-4353-8353-535353535353';
  const tenureAttr = '52525252-5252-4252-8252-525252525252';
  const aumAttr = '51515151-5151-4151-8151-515151515151';
  const examsAttr = '50505050-5050-4050-8050-505050505050';

  // three advisors: crd -> [tenure_months, firm_aum, exam_codes]
  const ADVISORS: [number, number, string, string[]][] = [
    [900_001, 120, '5000000000.00', ['S65', 'S7']],
    [900_002, 36, '250000000.00', ['S66']],
    [900_003, 240, '90000000.00', ['S65']],
  ];

  const recordId = (n: number): string =>
    `5900000${n}-5555-4555-8555-555555555555`;

  const attr = (
    over: Partial<AttributeMeta> & { id: string },
  ): AttributeMeta => ({
    entityId: entity,
    type: 'text',
    isMultiValue: false,
    relationshipType: null,
    isCanonicalSide: null,
    otherRelationshipSideAttributeId: null,
    referenceColumn: null,
    ...over,
  });

  const attributesById = new Map(
    [
      attr({ id: statusAttr }),
      attr({
        id: tenureAttr,
        type: 'number',
        referenceColumn: 'advisor.tenure_months',
      }),
      attr({
        id: aumAttr,
        type: 'currency',
        referenceColumn: 'advisor.firm_aum',
      }),
      attr({ id: examsAttr, referenceColumn: 'advisor.exam_codes' }),
    ].map((a) => [a.id, a]),
  );

  const run = async (
    filter: FilterTree | null,
    sort: SortAst = [],
  ): Promise<string[]> => {
    const { sql, params } = buildGridPageQuery({
      workspaceId: ws,
      entityId: entity,
      sourceKind: 'advisor',
      attributesById,
      filter,
      sort,
      limit: 50,
      offset: 0,
    });
    const { rows } = await db.query<{ source_crd: string }>(sql, params);

    return rows.map((r) => String(r.source_crd));
  };

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
       values ($1, $2, 'Advisor', 'grid-results-advisor') on conflict do nothing`,
      [entity, ws],
    );

    const attrDefs: [string, string, string, string][] = [
      [statusAttr, 'Status', 'status', 'text'],
      [tenureAttr, 'Tenure', 'tenure', 'number'],
      [aumAttr, 'Firm AUM', 'firm-aum', 'currency'],
      [examsAttr, 'Exams', 'exams', 'text'],
    ];

    for (const [id, label, key, type] of attrDefs) {
      await db.query(
        `insert into app.entity_attribute
           (id, entity_id, workspace_id, label, key, type, position)
         values ($1, $2, $3, $4, $5, $6::"app"."attribute_type", $7)
         on conflict do nothing`,
        [id, entity, ws, label, key, type, `a${id.slice(0, 2)}`],
      );
    }

    for (const [index, [crd, tenure, aum, exams]] of ADVISORS.entries()) {
      await db.query(
        `insert into market.advisor (advisor_crd) values ($1)
                      on conflict do nothing`,
        [crd],
      );
      await db.query(
        `insert into market.advisor_search
           (advisor_crd, full_name, tenure_months, firm_aum, exam_codes, disclosure_status)
         values ($1, $2, $3, $4, $5, 'none_reported')
         on conflict (advisor_crd) do update
            set tenure_months = excluded.tenure_months,
                firm_aum = excluded.firm_aum,
                exam_codes = excluded.exam_codes`,
        [crd, `Advisor ${crd}`, tenure, aum, exams],
      );
      await db.query(
        `insert into app.entity_record (id, entity_id, workspace_id, source_kind, source_crd)
         values ($1, $2, $3, 'advisor', $4) on conflict do nothing`,
        [recordId(index), entity, ws, crd],
      );
    }

    // only the first advisor is marked Contacted
    await writeCell(exec, {
      recordId: recordId(0),
      attributeId: statusAttr,
      workspaceId: ws,
      type: 'text',
      isMultiValue: false,
      value: 'Contacted',
      source: null,
    });
  });

  afterAll(async () => {
    await db.query('delete from app.entity where id = $1', [entity]);
    await db.query(
      'delete from market.advisor_search where advisor_crd = any($1::bigint[])',
      [ADVISORS.map(([crd]) => crd)],
    );
    await db.query(
      'delete from market.advisor where advisor_crd = any($1::bigint[])',
      [ADVISORS.map(([crd]) => crd)],
    );
    await db?.end();
  });

  it('returns every record with no filter', async () => {
    expect((await run(null)).sort()).toEqual(['900001', '900002', '900003']);
  });

  it('filters on a projected market column', async () => {
    const result = await run({
      kind: 'condition',
      path: [{ attributeId: tenureAttr }],
      operator: 'isGreaterThan',
      value: 100,
    } as FilterTree);

    expect(result.sort()).toEqual(['900001', '900003']);
  });

  it('filters on a user-authored eav cell', async () => {
    const result = await run({
      kind: 'condition',
      path: [{ attributeId: statusAttr }],
      operator: 'is',
      value: 'Contacted',
    } as FilterTree);

    expect(result).toEqual(['900001']);
  });

  it('intersects an eav and a reference predicate', async () => {
    const result = await run({
      kind: 'and',
      children: [
        {
          kind: 'condition',
          path: [{ attributeId: statusAttr }],
          operator: 'is',
          value: 'Contacted',
        },
        {
          kind: 'condition',
          path: [{ attributeId: tenureAttr }],
          operator: 'isGreaterThan',
          value: 200,
        },
      ],
    } as FilterTree);

    // 900001 is Contacted but has 120 months, so the intersection is empty
    expect(result).toEqual([]);
  });

  it('unions an eav and a reference predicate', async () => {
    const result = await run({
      kind: 'or',
      children: [
        {
          kind: 'condition',
          path: [{ attributeId: statusAttr }],
          operator: 'is',
          value: 'Contacted',
        },
        {
          kind: 'condition',
          path: [{ attributeId: tenureAttr }],
          operator: 'isGreaterThan',
          value: 200,
        },
      ],
    } as FilterTree);

    expect(result.sort()).toEqual(['900001', '900003']);
  });

  it('matches an array column by overlap', async () => {
    const result = await run({
      kind: 'condition',
      path: [{ attributeId: examsAttr }],
      operator: 'isAnyOf',
      value: ['S65'],
    } as FilterTree);

    expect(result.sort()).toEqual(['900001', '900003']);
  });

  it('negates with NOT', async () => {
    const result = await run({
      kind: 'not',
      child: {
        kind: 'condition',
        path: [{ attributeId: tenureAttr }],
        operator: 'isGreaterThan',
        value: 100,
      },
    } as FilterTree);

    expect(result).toEqual(['900002']);
  });

  it('sorts by a projected column descending', async () => {
    expect(
      await run(null, [
        { path: [{ attributeId: aumAttr }], direction: 'desc' },
      ]),
    ).toEqual(['900001', '900002', '900003']);
  });

  it('sorts by a projected column ascending', async () => {
    expect(
      await run(null, [
        { path: [{ attributeId: tenureAttr }], direction: 'asc' },
      ]),
    ).toEqual(['900002', '900001', '900003']);
  });

  it('counts what the page query returns', async () => {
    const filter = {
      kind: 'condition',
      path: [{ attributeId: tenureAttr }],
      operator: 'isGreaterThan',
      value: 100,
    } as FilterTree;

    const { sql, params } = buildGridCountQuery({
      workspaceId: ws,
      entityId: entity,
      sourceKind: 'advisor',
      attributesById,
      filter,
    });
    const { rows } = await db.query<{ total: string }>(sql, params);

    expect(Number(rows[0]?.total)).toBe((await run(filter)).length);
  });

  it('never returns another workspace’s records', async () => {
    const { sql, params } = buildGridPageQuery({
      workspaceId: '00000000-0000-4000-8000-000000000000',
      entityId: entity,
      sourceKind: 'advisor',
      attributesById,
      filter: null,
      sort: [],
      limit: 50,
      offset: 0,
    });
    const { rows } = await db.query(sql, params);

    expect(rows).toEqual([]);
  });

  describe('projected columns', () => {
    /**
     * The join alone only enables filtering and sorting. Until these values are
     * selected, every reference column renders blank — which reads as a broken
     * renderer rather than a missing SELECT.
     */
    it('returns the market value for a reference attribute', async () => {
      const { sql, params } = buildGridPageQuery({
        workspaceId: ws,
        entityId: entity,
        sourceKind: 'advisor',
        attributesById,
        filter: null,
        sort: [],
        limit: 50,
        offset: 0,
        referenceAttributeIds: [tenureAttr, aumAttr],
      });

      const { rows } = await db.query<Record<string, unknown>>(sql, params);

      expect(sql).toContain(`ref_${tenureAttr}`);

      const byCrd = new Map(rows.map((r) => [String(r.source_crd), r]));

      expect(Number(byCrd.get('900001')?.[`ref_${tenureAttr}`])).toBe(120);
      expect(Number(byCrd.get('900003')?.[`ref_${aumAttr}`])).toBe(90000000);
    });

    it('selects nothing extra when no reference attributes are asked for', async () => {
      const { sql } = buildGridPageQuery({
        workspaceId: ws,
        entityId: entity,
        sourceKind: 'advisor',
        attributesById,
        filter: null,
        sort: [],
        limit: 10,
        offset: 0,
      });

      expect(sql).not.toContain('ref_');
    });

    it('ignores an eav attribute asked for as a reference', async () => {
      const { sql } = buildGridPageQuery({
        workspaceId: ws,
        entityId: entity,
        sourceKind: 'advisor',
        attributesById,
        filter: null,
        sort: [],
        limit: 10,
        offset: 0,
        referenceAttributeIds: [statusAttr],
      });

      // statusAttr has no referenceColumn, so there is nothing on the projection
      expect(sql).not.toContain(`ref_${statusAttr}`);
    });
  });
});
