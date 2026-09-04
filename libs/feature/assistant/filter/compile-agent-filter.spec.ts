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
    expect(compileAgentFilter({ all: [], any: [] }, dictionary)).toEqual({
      ok: true,
      tree: null,
    });

    const single = compileAgentFilter(
      { all: [{ field: 'advisor.state', op: 'isEmpty' }], any: [] },
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

  it('reports every error at once, with near matches for unknown fields', () => {
    const result = compileAgentFilter(
      {
        all: [
          { field: 'advisor.states', op: 'isAnyOf', value: ['TX'] },
          { field: 'advisor.state', op: 'contains', value: 'T' },
          { field: 'advisor.tenure_years', op: 'isBetween', value: 5 },
          { field: 'advisor.exam_codes', op: 'isAnyOf', value: 'S65' },
        ],
        any: [
          {
            field: 'advisor.last_detected_on',
            op: 'isWithinLastNDays',
            value: -3,
          },
        ],
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
    expect(result.errors[1]?.message).toContain('supports isAnyOf');
    expect(result.errors[2]?.message).toContain('advisor.tenure_years');
    expect(result.errors[3]?.message).toContain('non-empty array');
  });
});

describe('renderFieldDictionary', () => {
  it('is sorted, one line per field, with option previews', () => {
    const text = renderFieldDictionary(dictionary);
    const lines = text.split('\n');

    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe(
      'advisor.exam_codes | advisor.exam_codes | multiSelect | isAnyOf/isNoneOf/isEmpty/isNotEmpty',
    );
    expect(lines[2]).toBe(
      'advisor.state | State | multiSelect | isAnyOf/isNoneOf/isEmpty/isNotEmpty | TX (Texas), CA (California)',
    );
    // same input, same bytes: the text sits in the cached prompt prefix
    expect(renderFieldDictionary(dictionary)).toBe(text);
  });
});
