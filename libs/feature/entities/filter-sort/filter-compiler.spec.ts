import { describe, expect, it } from 'vitest';

import type { AttributeMeta } from '../relationship-edges.js';
import type { FilterTree } from './ast.js';
import { compileFilterTree, type CompileContext } from './filter-compiler.js';

const attr = (over: Partial<AttributeMeta> & { id: string }): AttributeMeta => ({
  entityId: 'e1',
  type: 'text',
  isMultiValue: false,
  relationshipType: null,
  isCanonicalSide: null,
  otherRelationshipSideAttributeId: null,
  referenceColumn: null,
  ...over,
});

const EAV_TEXT = attr({ id: 'a-text' });
const EAV_NUM = attr({ id: 'a-num', type: 'number' });
const REF_TENURE = attr({ id: 'a-tenure', type: 'number', referenceColumn: 'advisor.tenure_months' });
const REF_EXAMS = attr({ id: 'a-exams', type: 'text', referenceColumn: 'advisor.exam_codes' });
const REF_BOGUS = attr({ id: 'a-bogus', type: 'text', referenceColumn: 'advisor.not_allowlisted' });
const REL = attr({ id: 'a-rel', type: 'relationship', relationshipType: 'manyToOne', isCanonicalSide: true });

/** captures every value that reaches SQL, so tests can assert none are inlined */
const makeCtx = (over: Partial<CompileContext> = {}) => {
  const params: unknown[] = [];

  const ctx: CompileContext = {
    attributesById: new Map(
      [EAV_TEXT, EAV_NUM, REF_TENURE, REF_EXAMS, REF_BOGUS, REL].map((a) => [a.id, a]),
    ),
    recordAlias: 'er',
    workspaceParam: '$1',
    referenceAlias: 'ref',
    addParam: (value) => {
      params.push(value);

      return `$${params.length + 1}`;
    },
    ...over,
  };

  return { ctx, params };
};

const cond = (attributeId: string, operator: string, value?: unknown): FilterTree =>
  ({ kind: 'condition', path: [{ attributeId }], operator, value }) as FilterTree;

describe('filter compiler', () => {
  describe('parameterization', () => {
    it('never places a filter value in the SQL text', () => {
      const { ctx, params } = makeCtx();
      const sql = compileFilterTree(cond('a-text', 'contains', "'; DROP TABLE x --"), ctx);

      expect(sql).not.toContain('DROP TABLE');
      expect(params).toContain("%'; DROP TABLE x --%");
    });

    it('parameterizes the day count in isWithinLastNDays', () => {
      const { ctx, params } = makeCtx();
      const sql = compileFilterTree(
        { kind: 'condition', path: [{ attributeId: 'a-tenure' }], operator: 'isWithinLastNDays', value: 30 } as FilterTree,
        { ...ctx, attributesById: new Map([['a-tenure', attr({ id: 'a-tenure', type: 'date' })]]) },
      );

      expect(sql).toContain('make_interval');
      expect(sql).not.toMatch(/'30 days'/);
      expect(params).toContain(30);
    });

    it('scopes every eav predicate by workspace', () => {
      const { ctx } = makeCtx();

      expect(compileFilterTree(cond('a-text', 'is', 'x'), ctx)).toContain('workspace_id = $1');
    });
  });

  describe('fail-soft', () => {
    it('drops a condition on a deleted attribute', () => {
      const { ctx } = makeCtx();

      expect(compileFilterTree(cond('gone', 'is', 'x'), ctx)).toBeNull();
    });

    it('collapses an and-branch whose children all drop', () => {
      const { ctx } = makeCtx();
      const tree: FilterTree = { kind: 'and', children: [cond('gone', 'is', 'x')] };

      expect(compileFilterTree(tree, ctx)).toBeNull();
    });

    it('keeps the surviving sibling of a dropped condition', () => {
      const { ctx } = makeCtx();
      const tree: FilterTree = {
        kind: 'and',
        children: [cond('gone', 'is', 'x'), cond('a-text', 'is', 'keep')],
      };

      expect(compileFilterTree(tree, ctx)).toContain('EXISTS');
    });

    it('rejects an operator the attribute type does not support', () => {
      const { ctx } = makeCtx();

      expect(compileFilterTree(cond('a-num', 'startsWith', 'x'), ctx)).toBeNull();
    });
  });

  describe('reference attributes', () => {
    it('joins the projection instead of an EXISTS over cells', () => {
      const { ctx, params } = makeCtx();
      const sql = compileFilterTree(cond('a-tenure', 'isGreaterThan', 84), ctx);

      expect(sql).toBe('ref.tenure_months > $2');
      expect(sql).not.toContain('EXISTS');
      expect(params).toEqual([84]);
    });

    it('refuses a column outside the allowlist', () => {
      const { ctx } = makeCtx();

      expect(compileFilterTree(cond('a-bogus', 'is', 'x'), ctx)).toBeNull();
    });

    it('refuses when the entity has no projection joined', () => {
      const { ctx } = makeCtx({ referenceAlias: null });

      expect(compileFilterTree(cond('a-tenure', 'isGreaterThan', 84), ctx)).toBeNull();
    });

    it('cannot be traversed through as a relationship hop', () => {
      const { ctx } = makeCtx();
      const tree: FilterTree = {
        kind: 'condition',
        path: [{ attributeId: 'a-tenure' }, { attributeId: 'a-text' }],
        operator: 'is',
        value: 'x',
      };

      expect(compileFilterTree(tree, ctx)).toBeNull();
    });

    it('uses array overlap for array columns', () => {
      const { ctx, params } = makeCtx();
      const sql = compileFilterTree(cond('a-exams', 'isAnyOf', ['S65', 'S66']), ctx);

      expect(sql).toBe('ref.exam_codes && $2');
      expect(params).toEqual([['S65', 'S66']]);
    });

    it('treats an empty array as absent', () => {
      const { ctx } = makeCtx();

      expect(compileFilterTree(cond('a-exams', 'isEmpty'), ctx)).toContain('cardinality');
    });
  });

  describe('mixed trees', () => {
    it('compiles an eav condition and a reference condition together', () => {
      const { ctx } = makeCtx();
      const tree: FilterTree = {
        kind: 'and',
        children: [cond('a-text', 'is', 'Contacted'), cond('a-tenure', 'isGreaterThan', 84)],
      };

      const sql = compileFilterTree(tree, ctx);

      expect(sql).toContain('EXISTS');
      expect(sql).toContain('ref.tenure_months');
    });

    it('negates with NOT', () => {
      const { ctx } = makeCtx();
      const tree: FilterTree = { kind: 'not', child: cond('a-tenure', 'isGreaterThan', 84) };

      expect(compileFilterTree(tree, ctx)).toBe('NOT (ref.tenure_months > $2)');
    });
  });

  describe('relationships', () => {
    it('rejects a relationship attribute as a terminal', () => {
      const { ctx } = makeCtx();

      expect(compileFilterTree(cond('a-rel', 'is', 'x'), ctx)).toBeNull();
    });

    it('rejects a non-relationship attribute used as a hop', () => {
      const { ctx } = makeCtx();
      const tree: FilterTree = {
        kind: 'condition',
        path: [{ attributeId: 'a-text' }, { attributeId: 'a-text' }],
        operator: 'is',
        value: 'x',
      };

      expect(compileFilterTree(tree, ctx)).toBeNull();
    });
  });
});
