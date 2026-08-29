import { describe, expect, it } from 'vitest';

import type { AttributeMeta } from '@feature/entities/relationship-edges.js';

import { unresolvableAttributeIds } from './assert-resolvable.js';
import { buildProspectSearchQuery } from './prospect-query.builder.js';

const STATE = '01a04f39-562d-764f-8ce6-1167e2f53556';
const EXAMS = '01a04f39-5640-7000-8ce6-1167e2f53557';
const NAME = '01a04f39-5600-7197-adb9-186742fcdf7b';

const attribute = (
  id: string,
  referenceColumn: string,
  type: AttributeMeta['type'],
): AttributeMeta => ({
  id,
  entityId: 'e1',
  type,
  isMultiValue: false,
  relationshipType: null,
  isCanonicalSide: null,
  otherRelationshipSideAttributeId: null,
  referenceColumn,
});

const attributesById = new Map<string, AttributeMeta>([
  [STATE, attribute(STATE, 'advisor.state', 'text')],
  [EXAMS, attribute(EXAMS, 'advisor.exam_codes', 'text')],
  [NAME, attribute(NAME, 'advisor.full_name', 'text')],
]);

const build = (
  filter: Parameters<typeof buildProspectSearchQuery>[0]['filter'],
) =>
  buildProspectSearchQuery({
    workspaceId: 'ws1',
    entityId: 'e1',
    sourceKind: 'advisor',
    attributesById,
    filter,
    sort: [],
    selectAttributeIds: [NAME],
    limit: 50,
    offset: 0,
  });

describe('buildProspectSearchQuery', () => {
  it('reads from the projection, not the tenant record table', () => {
    const { sql } = build(null);

    expect(sql).toContain('FROM market.advisor_search ref');
    expect(sql).toContain('LEFT JOIN app.entity_record er');
  });

  it('scopes the saved-record join without filtering market rows away', () => {
    const { sql } = build(null);
    const onClause = sql.slice(
      sql.indexOf('LEFT JOIN'),
      sql.indexOf('ORDER BY'),
    );

    expect(onClause).toContain('er.workspace_id');
    expect(onClause).toContain('er.entity_id');
  });

  it('parameterizes every value', () => {
    const { sql, params } = build({
      kind: 'and',
      children: [
        {
          kind: 'condition',
          path: [{ attributeId: STATE }],
          operator: 'isAnyOf',
          value: ['CA'],
        },
      ],
    });

    expect(sql).not.toContain("'CA'");
    expect(params).toContainEqual(['CA']);
  });

  it('uses overlap for array columns rather than scalar comparison', () => {
    const { sql } = build({
      kind: 'condition',
      path: [{ attributeId: EXAMS }],
      operator: 'isAnyOf',
      value: ['S65'],
    });

    expect(sql).toContain('ref.exam_codes && ');
  });

  it('always orders by the projection key so paging is deterministic', () => {
    const { sql } = build(null);

    expect(sql).toContain('ORDER BY ref.advisor_crd ASC');
  });
});

describe('unresolvableAttributeIds', () => {
  const known = new Set(attributesById.keys());

  it('accepts a tree whose attributes all exist', () => {
    expect(
      unresolvableAttributeIds(
        {
          kind: 'condition',
          path: [{ attributeId: STATE }],
          operator: 'is',
          value: 'CA',
        },
        known,
      ),
    ).toEqual([]);
  });

  /** the compiler would drop this silently and return every row */
  it('reports an unknown attribute rather than letting the filter vanish', () => {
    expect(
      unresolvableAttributeIds(
        {
          kind: 'and',
          children: [
            {
              kind: 'condition',
              path: [{ attributeId: STATE }],
              operator: 'is',
              value: 'CA',
            },
            {
              kind: 'condition',
              path: [{ attributeId: 'missing' }],
              operator: 'is',
              value: 'x',
            },
          ],
        },
        known,
      ),
    ).toEqual(['missing']);
  });

  it('walks not branches', () => {
    expect(
      unresolvableAttributeIds(
        {
          kind: 'not',
          child: {
            kind: 'condition',
            path: [{ attributeId: 'gone' }],
            operator: 'is',
            value: 1,
          },
        },
        known,
      ),
    ).toEqual(['gone']);
  });
});
