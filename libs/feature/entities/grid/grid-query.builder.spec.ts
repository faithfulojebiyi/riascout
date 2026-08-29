import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { FilterTree, SortAst } from '../filter-sort/ast.js';
import type { AttributeMeta } from '../relationship-edges.js';
import {
  buildGridCountQuery,
  buildGridPageQuery,
} from './grid-query.builder.js';

/**
 * These execute the compiled SQL rather than asserting on its text. A string
 * assertion cannot tell a valid predicate from one postgres rejects, which is
 * the only failure that actually matters here.
 */
describe('grid query builder', () => {
  let db: Client;

  const attr = (
    over: Partial<AttributeMeta> & { id: string },
  ): AttributeMeta => ({
    entityId: 'e1',
    type: 'text',
    isMultiValue: false,
    relationshipType: null,
    isCanonicalSide: null,
    otherRelationshipSideAttributeId: null,
    referenceColumn: null,
    ...over,
  });

  const STATUS = attr({ id: '11111111-1111-4111-8111-111111111111' });
  const TENURE = attr({
    id: '22222222-2222-4222-8222-222222222222',
    type: 'number',
    referenceColumn: 'advisor.tenure_months',
  });
  const EXAMS = attr({
    id: '33333333-3333-4333-8333-333333333333',
    referenceColumn: 'advisor.exam_codes',
  });
  const AUM = attr({
    id: '44444444-4444-4444-8444-444444444444',
    type: 'currency',
    referenceColumn: 'advisor.firm_aum',
  });

  const base = {
    workspaceId: '99999999-9999-4999-8999-999999999999',
    entityId: '88888888-8888-4888-8888-888888888888',
    sourceKind: 'advisor' as const,
    attributesById: new Map([STATUS, TENURE, EXAMS, AUM].map((a) => [a.id, a])),
  };

  const page = (filter: FilterTree | null, sort: SortAst = []) =>
    buildGridPageQuery({ ...base, filter, sort, limit: 25, offset: 0 });

  /** postgres parses and plans without executing — proves the SQL is legal */
  const explains = async (sql: string, params: unknown[]): Promise<void> => {
    await db.query(`EXPLAIN ${sql}`, params);
  };

  beforeAll(async () => {
    const connectionString = process.env.APP_DATABASE_URL;

    if (!connectionString) {
      throw new Error('APP_DATABASE_URL is required to run grid query tests');
    }

    db = new Client({ connectionString });
    await db.connect();
  });

  afterAll(async () => {
    await db?.end();
  });

  describe('executes against a real schema', () => {
    it('runs with no filter and no sort', async () => {
      const { sql, params } = page(null);

      await expect(db.query(sql, params)).resolves.toBeDefined();
    });

    it('runs an eav filter', async () => {
      const { sql, params } = page({
        kind: 'condition',
        path: [{ attributeId: STATUS.id }],
        operator: 'is',
        value: 'Contacted',
      } as FilterTree);

      await expect(db.query(sql, params)).resolves.toBeDefined();
    });

    it('runs a reference filter through the market join', async () => {
      const { sql, params } = page({
        kind: 'condition',
        path: [{ attributeId: TENURE.id }],
        operator: 'isGreaterThan',
        value: 84,
      } as FilterTree);

      expect(sql).toContain('market.advisor_search');
      await expect(db.query(sql, params)).resolves.toBeDefined();
    });

    it('runs an array-overlap reference filter', async () => {
      const { sql, params } = page({
        kind: 'condition',
        path: [{ attributeId: EXAMS.id }],
        operator: 'isAnyOf',
        value: ['S65', 'S66'],
      } as FilterTree);

      await expect(db.query(sql, params)).resolves.toBeDefined();
    });

    it('runs eav and reference predicates in one statement', async () => {
      const { sql, params } = page({
        kind: 'and',
        children: [
          {
            kind: 'condition',
            path: [{ attributeId: STATUS.id }],
            operator: 'is',
            value: 'Contacted',
          },
          {
            kind: 'condition',
            path: [{ attributeId: TENURE.id }],
            operator: 'isGreaterThan',
            value: 84,
          },
        ],
      } as FilterTree);

      expect(sql).toContain('EXISTS');
      expect(sql).toContain('ref.tenure_months');
      await expect(db.query(sql, params)).resolves.toBeDefined();
    });

    it('runs a reference sort', async () => {
      const { sql, params } = page(null, [
        { path: [{ attributeId: AUM.id }], direction: 'desc' },
      ]);

      expect(sql).toContain('ref.firm_aum DESC NULLS LAST');
      await expect(db.query(sql, params)).resolves.toBeDefined();
    });

    it('runs an eav sort', async () => {
      const { sql, params } = page(null, [
        { path: [{ attributeId: STATUS.id }], direction: 'asc' },
      ]);

      expect(sql).toContain('LEFT JOIN app.entity_record_value');
      await expect(db.query(sql, params)).resolves.toBeDefined();
    });

    it('runs a multi-column sort mixing eav and reference', async () => {
      const { sql, params } = page(null, [
        { path: [{ attributeId: AUM.id }], direction: 'desc' },
        { path: [{ attributeId: STATUS.id }], direction: 'asc' },
      ]);

      await expect(db.query(sql, params)).resolves.toBeDefined();
    });

    it('runs the count query', async () => {
      const { sql, params } = buildGridCountQuery({
        ...base,
        filter: {
          kind: 'condition',
          path: [{ attributeId: TENURE.id }],
          operator: 'isGreaterThan',
          value: 84,
        } as FilterTree,
      });

      const { rows } = await db.query<{ total: string }>(sql, params);

      expect(Number(rows[0]?.total)).toBe(0);
    });

    it('plans a deep multi-hop relationship sort', async () => {
      const rel = attr({
        id: '55555555-5555-4555-8555-555555555555',
        type: 'relationship',
        relationshipType: 'manyToOne',
        isCanonicalSide: true,
      });
      const { sql, params } = buildGridPageQuery({
        ...base,
        attributesById: new Map([...base.attributesById, [rel.id, rel]]),
        filter: null,
        sort: [
          {
            path: [{ attributeId: rel.id }, { attributeId: STATUS.id }],
            direction: 'asc',
          },
        ],
        limit: 10,
        offset: 0,
      });

      await expect(explains(sql, params)).resolves.toBeUndefined();
    });
  });

  describe('parameterization', () => {
    it('places no filter value in the SQL text', () => {
      const { sql, params } = page({
        kind: 'condition',
        path: [{ attributeId: STATUS.id }],
        operator: 'contains',
        value: "'; DROP TABLE app.entity_record --",
      } as FilterTree);

      expect(sql).not.toContain('DROP TABLE');
      expect(params).toContain("%'; DROP TABLE app.entity_record --%");
    });

    it('scopes every query by workspace', () => {
      expect(page(null).sql).toContain('er.workspace_id = $1');
    });

    it('omits the market join when the entity has no source kind', () => {
      const { sql } = buildGridPageQuery({
        ...base,
        sourceKind: null,
        filter: null,
        sort: [],
        limit: 5,
        offset: 0,
      });

      expect(sql).not.toContain('market.');
    });

    it('drops a reference condition when no projection is joined', () => {
      const { sql } = buildGridPageQuery({
        ...base,
        sourceKind: null,
        filter: {
          kind: 'condition',
          path: [{ attributeId: TENURE.id }],
          operator: 'isGreaterThan',
          value: 84,
        } as FilterTree,
        sort: [],
        limit: 5,
        offset: 0,
      });

      expect(sql).not.toContain('tenure_months');
    });
  });
});
