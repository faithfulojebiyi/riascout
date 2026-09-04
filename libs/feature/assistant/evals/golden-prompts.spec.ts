import { describe, expect, it } from 'vitest';

import { glossaryFor } from '@feature/entities/data/column-glossary.js';
import {
  compileFilterTree,
  type CompileContext,
} from '@feature/entities/filter-sort/filter-compiler.js';

import { compileAgentFilter } from '../filter/compile-agent-filter.js';
import {
  fixtureAttributeMeta,
  fixtureDictionary,
} from './fixture-dictionary.js';
import { GOLDEN_CASES, type GoldenKind } from './golden-prompts.js';

const KINDS: GoldenKind[] = ['numeric', 'time', 'credential', 'shape', 'null'];

describe('golden prompts', () => {
  it('covers every request type', () => {
    for (const kind of KINDS) {
      expect(
        GOLDEN_CASES.filter((c) => c.kind === kind).length,
      ).toBeGreaterThanOrEqual(10);
    }
    expect(new Set(GOLDEN_CASES.map((c) => c.id)).size).toBe(
      GOLDEN_CASES.length,
    );
  });

  for (const goldenCase of GOLDEN_CASES) {
    if (!('filter' in goldenCase.expect)) continue;

    const { sourceKind, expect: expected } = goldenCase;

    it(`${goldenCase.id}: expected filter compiles and reaches SQL`, () => {
      const dictionary = fixtureDictionary(sourceKind);
      const compiled = compileAgentFilter(expected.filter, dictionary);

      if (!compiled.ok) {
        throw new Error(JSON.stringify(compiled.errors, null, 2));
      }

      if (!compiled.tree) throw new Error('expected a non-empty tree');

      const params: unknown[] = [];
      const ctx: CompileContext = {
        attributesById: fixtureAttributeMeta(sourceKind),
        recordAlias: 'er',
        workspaceParam: '$1',
        referenceAlias: 'ref',
        addParam: (value) => {
          params.push(value);

          return `$${params.length + 1}`;
        },
      };
      const sql = compileFilterTree(compiled.tree, ctx);

      // fail-soft compiler: a dropped condition would silently widen the search
      expect(sql).not.toBeNull();
      expect(params.length).toBeGreaterThan(0);
    });

    it(`${goldenCase.id}: every field has a glossary entry`, () => {
      const fields = [
        ...expected.filter.all,
        ...expected.filter.any,
        ...expected.filter.none,
      ].map((c) => c.field);

      const missing = fields.filter((field) => glossaryFor(field) === null);

      expect(missing).toEqual([]);
    });
  }
});
