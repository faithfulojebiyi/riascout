import { describe, expect, it } from 'vitest';

import { buildInsertMembers, buildUpsertRecords } from './bulk-add.builder.js';

const input = {
  listId: '01a04f39-55f1-7185-aa99-066c27adf7c2',
  entityId: '01a04f39-5692-752b-94d7-c54661fbf854',
  workspaceId: 'ws1',
  sourceKind: 'advisor' as const,
  userId: 'u1',
  sourceCrds: ['170', '290', '353'],
};

describe('buildUpsertRecords', () => {
  it('adds every crd in one statement, not one per advisor', () => {
    const { sql, params } = buildUpsertRecords(input);

    expect(sql).toContain('unnest($4::text[])');
    expect(params[3]).toEqual(['170', '290', '353']);
    expect(sql.match(/INSERT INTO/g)).toHaveLength(1);
  });

  /**
   * DO NOTHING returns no row for an advisor already in the CRM, so the
   * membership insert would silently skip exactly the ones already saved.
   */
  it('returns ids for existing records too, not just new ones', () => {
    const { sql } = buildUpsertRecords(input);

    expect(sql).toContain('DO UPDATE');
    expect(sql).not.toContain('DO NOTHING');
    expect(sql).toContain('RETURNING id, source_crd');
  });

  it('reports which rows were newly inserted', () => {
    expect(buildUpsertRecords(input).sql).toContain('(xmax = 0) AS inserted');
  });

  it('scopes the conflict target to the workspace', () => {
    expect(buildUpsertRecords(input).sql).toContain(
      'ON CONFLICT (entity_id, source_kind, source_crd, workspace_id)',
    );
  });

  it('binds every value rather than interpolating', () => {
    const { sql } = buildUpsertRecords(input);

    expect(sql).not.toContain("'advisor'");
    expect(sql).not.toContain('ws1');
  });
});

describe('buildInsertMembers', () => {
  it('adds all memberships in one statement', () => {
    const { sql, params } = buildInsertMembers(input, ['r1', 'r2']);

    expect(sql).toContain('unnest($4::uuid[])');
    expect(params[3]).toEqual(['r1', 'r2']);
  });

  /** re-adding a record already in the list is not an error */
  it('is idempotent on membership', () => {
    expect(buildInsertMembers(input, ['r1']).sql).toContain(
      'ON CONFLICT (list_id, record_id) DO NOTHING',
    );
  });

  it('records who added them', () => {
    const { params } = buildInsertMembers(input, ['r1']);

    expect(params[2]).toBe('u1');
  });
});
