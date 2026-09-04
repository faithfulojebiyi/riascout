import { describe, expect, it } from 'vitest';

import type { AttributeMeta } from '@feature/entities/relationship-edges.js';
import {
  compileFilterTree,
  type CompileContext,
} from '@feature/entities/filter-sort/filter-compiler.js';
import type { FacetDefinition } from '@feature/prospecting/facets/facet-definitions.js';

import { agentFilterSchema } from './agent-filter.schema.js';
import { compileAgentFilter } from './compile-agent-filter.js';
import {
  buildFieldDictionary,
  renderFieldDictionary,
} from './field-dictionary.js';

const facet = (
  over: Partial<FacetDefinition> & { allowKey: string; attributeId: string },
): FacetDefinition => ({
  label: over.allowKey,
  icon: null,
  description: null,
  group: 'Identity',
  kind: 'multiSelect',
  type: 'text',
  operators: ['isAnyOf', 'isNoneOf', 'isEmpty', 'isNotEmpty'],
  isArray: false,
  options: [],
  ...over,
});

const STATE = facet({
  allowKey: 'advisor.state',
  attributeId: 'a-state',
  label: 'State',
  options: [
    { value: 'TX', label: 'Texas' },
    { value: 'CA', label: 'California' },
  ],
});
const TENURE = facet({
  allowKey: 'advisor.tenure_years',
  attributeId: 'a-tenure',
  kind: 'number',
  type: 'number',
  operators: [
    'isGreaterThan',
    'isLessThan',
    'isBetween',
    'isEmpty',
    'isNotEmpty',
  ],
});
const EXAMS = facet({
  allowKey: 'advisor.exam_codes',
  attributeId: 'a-exams',
  isArray: true,
});
const DETECTED = facet({
  allowKey: 'advisor.last_detected_on',
  attributeId: 'a-detected',
  kind: 'date',
  type: 'date',
  operators: ['isWithinLastNDays', 'isAfter', 'isBefore', 'isBetween'],
});

const dictionary = buildFieldDictionary([STATE, TENURE, EXAMS, DETECTED]);

const meta = (definition: FacetDefinition): AttributeMeta => ({
  id: definition.attributeId,
  entityId: 'e1',
  type: definition.type,
  isMultiValue: false,
  relationshipType: null,
  isCanonicalSide: null,
  otherRelationshipSideAttributeId: null,
  referenceColumn: definition.allowKey,
});

/** the emitted tree must compile with the real compiler, and bind every value */
const compileToSql = (tree: Parameters<typeof compileFilterTree>[0]) => {
  const params: unknown[] = [];
  const ctx: CompileContext = {
    attributesById: new Map(
      [STATE, TENURE, EXAMS, DETECTED].map((definition) => [
        definition.attributeId,
        meta(definition),
      ]),
    ),
    recordAlias: 'er',
    workspaceParam: '$1',
    referenceAlias: 'ref',
    addParam: (value) => {
      params.push(value);

      return `$${params.length + 1}`;
    },
  };

  return { sql: compileFilterTree(tree, ctx), params };
};

describe('compileAgentFilter', () => {
  it('compiles all/any into and/or with attribute ids', () => {
    const result = compileAgentFilter(
      agentFilterSchema.parse({
        all: [
          { field: 'advisor.state', op: 'isAnyOf', value: ['TX'] },
          { field: 'advisor.tenure_years', op: 'isGreaterThan', value: 5 },
        ],
        any: [
          { field: 'advisor.exam_codes', op: 'isAnyOf', value: ['S65'] },
          {
            field: 'advisor.last_detected_on',
            op: 'isWithinLastNDays',
            value: 90,
          },
        ],
      }),
      dictionary,
    );

    expect(result.ok).toBe(true);

    if (!result.ok || !result.tree) throw new Error('expected a tree');

    expect(result.tree).toEqual({
      kind: 'and',
      children: [
        {
          kind: 'condition',
          path: [{ attributeId: 'a-state' }],
          operator: 'isAnyOf',
          value: ['TX'],
        },
        {
          kind: 'condition',
          path: [{ attributeId: 'a-tenure' }],
          operator: 'isGreaterThan',
          value: 5,
        },
        {
          kind: 'or',
          children: [
            {
              kind: 'condition',
              path: [{ attributeId: 'a-exams' }],
              operator: 'isAnyOf',
              value: ['S65'],
            },
            {
              kind: 'condition',
              path: [{ attributeId: 'a-detected' }],
              operator: 'isWithinLastNDays',
              value: 90,
            },
          ],
        },
      ],
    });

    const { sql, params } = compileToSql(result.tree);

    expect(sql).toContain('ref.state = ANY($2)');
    expect(sql).toContain('ref.tenure_years > $3');
    expect(sql).toContain('ref.exam_codes && $4');
    expect(sql).toContain('make_interval(days => $5)');
    expect(params).toEqual([['TX'], 5, ['S65'], 90]);
  });

  it('returns null for an empty filter and a bare condition for one', () => {
    expect(
      compileAgentFilter({ all: [], any: [], none: [] }, dictionary),
    ).toEqual({
      ok: true,
      tree: null,
    });

    const single = compileAgentFilter(
      { all: [{ field: 'advisor.state', op: 'isEmpty' }], any: [], none: [] },
      dictionary,
    );

    expect(single).toEqual({
      ok: true,
      tree: {
        kind: 'condition',
        path: [{ attributeId: 'a-state' }],
        operator: 'isEmpty',
        value: null,
      },
    });
  });

  it('reports every error at once, with near matches and examples', () => {
    const result = compileAgentFilter(
      {
        all: [
          { field: 'advisor.states', op: 'isAnyOf', value: ['TX'] },
          { field: 'advisor.state', op: 'isWithinLastNDays', value: 3 },
          { field: 'advisor.tenure_years', op: 'isBetween', value: 5 },
          { field: 'advisor.exam_codes', op: 'isAnyOf', value: [] },
        ],
        any: [
          {
            field: 'advisor.last_detected_on',
            op: 'isWithinLastNDays',
            value: -3,
          },
        ],
        none: [],
      },
      dictionary,
    );

    expect(result.ok).toBe(false);

    if (result.ok) throw new Error('expected errors');

    expect(result.errors.map((error) => error.path)).toEqual([
      'all[0]',
      'all[1]',
      'all[2]',
      'all[3]',
      'any[0]',
    ]);
    expect(result.errors[0]?.nearMatches).toEqual(['advisor.state']);
    expect(result.errors[1]?.message).toContain('supports');
    expect(result.errors[1]?.example).toEqual({
      field: 'advisor.state',
      op: 'isAnyOf',
      value: ['TX'],
    });
    expect(result.errors[2]?.message).toContain('[low, high]');
    expect(result.errors[3]?.message).toContain('at least one value');
    expect(result.errors[4]?.message).toContain('positive whole number');
  });

  it('suggests a field from a glossary alias', () => {
    const result = compileAgentFilter(
      {
        all: [{ field: 'book', op: 'isGreaterThan', value: 1 }],
        any: [],
        none: [],
      },
      buildFieldDictionary([
        facet({
          allowKey: 'advisor.firm_aum',
          attributeId: 'a-aum',
          kind: 'number',
          type: 'currency',
          operators: ['isGreaterThan', 'isLessThan', 'isBetween'],
        }),
      ]),
    );

    expect(result.ok).toBe(false);

    if (result.ok) throw new Error('expected errors');

    expect(result.errors[0]?.nearMatches).toEqual(['advisor.firm_aum']);
  });

  it('compiles none into not(or) and normalises loose values', () => {
    const result = compileAgentFilter(
      {
        all: [
          {
            field: 'advisor.tenure_years',
            op: 'isBetween',
            value: { min: '1', max: 5 },
          },
          { field: 'advisor.exam_codes', op: 'isAnyOf', value: 'S65' },
          {
            field: 'advisor.last_detected_on',
            op: 'isAfter',
            value: '2026-01',
          },
        ],
        any: [],
        none: [{ field: 'advisor.state', op: 'isAnyOf', value: ['NY', 'NJ'] }],
      },
      dictionary,
    );

    expect(result.ok).toBe(true);

    if (!result.ok || !result.tree) throw new Error('expected a tree');

    expect(result.tree).toEqual({
      kind: 'and',
      children: [
        {
          kind: 'condition',
          path: [{ attributeId: 'a-tenure' }],
          operator: 'isBetween',
          value: [1, 5],
        },
        {
          kind: 'condition',
          path: [{ attributeId: 'a-exams' }],
          operator: 'isAnyOf',
          value: ['S65'],
        },
        {
          kind: 'condition',
          path: [{ attributeId: 'a-detected' }],
          operator: 'isAfter',
          value: '2026-01-01',
        },
        {
          kind: 'not',
          child: {
            kind: 'condition',
            path: [{ attributeId: 'a-state' }],
            operator: 'isAnyOf',
            value: ['NY', 'NJ'],
          },
        },
      ],
    });

    const { sql } = compileToSql(result.tree);

    expect(sql).toContain('NOT (ref.state = ANY(');
    expect(sql).toContain('BETWEEN');
  });

  it('rejects "X and Y" packed into one array value with an all-of hint', () => {
    const result = compileAgentFilter(
      {
        all: [
          { field: 'advisor.exam_codes', op: 'isAnyOf', value: ['S7 and S65'] },
        ],
        any: [],
        none: [],
      },
      dictionary,
    );

    expect(result.ok).toBe(false);

    if (result.ok) throw new Error('expected errors');

    expect(result.errors[0]?.hint).toContain('one condition per value');
  });

  it('lets scalar numbers use is and isNot beyond the rail operators', () => {
    const result = compileAgentFilter(
      {
        all: [{ field: 'advisor.tenure_years', op: 'is', value: '$3' }],
        any: [],
        none: [],
      },
      dictionary,
    );

    expect(result).toEqual({
      ok: true,
      tree: {
        kind: 'condition',
        path: [{ attributeId: 'a-tenure' }],
        operator: 'is',
        value: 3,
      },
    });
  });
});

describe('renderFieldDictionary', () => {
  it('is sorted, one line per field, with glossary meaning and option previews', () => {
    const text = renderFieldDictionary(dictionary);
    const lines = text.split('\n');

    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatch(
      /^advisor\.exam_codes \| advisor\.exam_codes \| multiSelect \| isAnyOf\/isNoneOf\/isEmpty\/isNotEmpty \| /,
    );
    expect(lines[0]).toContain('aka: Series 7');
    expect(lines[2]).toContain('advisor.state | State | multiSelect |');
    expect(lines[2]).toContain('TX (Texas), CA (California)');
    // same input, same bytes: the text sits in the cached prompt prefix
    expect(renderFieldDictionary(dictionary)).toBe(text);
  });
});
