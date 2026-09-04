import {
  glossaryFor,
  glossaryKeysForAlias,
} from '@feature/entities/data/column-glossary.js';
import type {
  FilterCondition,
  FilterTree,
} from '@feature/entities/filter-sort/ast.js';
import { operatorRegistry } from '@feature/entities/filter-sort/operator-registry.js';
import type { FacetDefinition } from '@feature/prospecting/facets/facet-definitions.js';

import type {
  AgentCondition,
  AgentFilter,
  AgentFilterGroup,
} from './agent-filter.schema.js';
import { agentOperatorsFor } from './agent-operators.js';
import type { FieldDictionary } from './field-dictionary.js';
import { normaliseValue } from './normalise-value.js';

export type AgentFilterError = {
  /** "all[0]" / "none[2]" so the model can point at the offending condition */
  path: string;
  message: string;
  nearMatches?: string[];
  /** a known-good condition for the field, when the glossary has one */
  example?: AgentCondition;
  hint?: string;
};

export type CompileAgentFilterResult =
  | { ok: true; tree: FilterTree | null }
  | { ok: false; errors: AgentFilterError[] };

const NEAR_MATCH_LIMIT = 5;
const PRESENCE_OPS = new Set(['isEmpty', 'isNotEmpty']);
const ALL_OF_HINT =
  'array fields match any of the listed values; for "X and Y" add one condition per value in `all`';

const tokensOf = (key: string): string[] =>
  key
    .toLowerCase()
    .replace(/^(advisor|firm)\./, '')
    .split(/[._\s]+/)
    .filter((token) => token.length > 2);

/**
 * Glossary aliases first ("book" is advisor.firm_aum), then token prefix
 * overlap in either direction ("states" ~ "state", "aum" ~ "aum_band").
 */
const nearMatches = (field: string, dictionary: FieldDictionary): string[] => {
  const byAlias = glossaryKeysForAlias(
    field.replace(/^(advisor|firm)\./, ''),
  ).filter((key) => dictionary.has(key));
  const needleTokens = tokensOf(field);
  const byToken = [...dictionary.keys()].filter((key) =>
    tokensOf(key).some((token) =>
      needleTokens.some(
        (needle) => token.startsWith(needle) || needle.startsWith(token),
      ),
    ),
  );

  return [...new Set([...byAlias, ...byToken.sort()])].slice(
    0,
    NEAR_MATCH_LIMIT,
  );
};

const exampleFor = (field: string): AgentCondition | undefined => {
  const example = glossaryFor(field)?.example;

  return example ? { field, op: example.op, value: example.value } : undefined;
};

const looksLikeAllOf = (
  facet: FacetDefinition,
  condition: AgentCondition,
): boolean =>
  facet.isArray &&
  condition.op === 'isAnyOf' &&
  Array.isArray(condition.value) &&
  condition.value.length === 1 &&
  typeof condition.value[0] === 'string' &&
  / and /i.test(condition.value[0]);

const compileCondition = (
  condition: AgentCondition,
  path: string,
  dictionary: FieldDictionary,
): { condition: FilterCondition } | { error: AgentFilterError } => {
  const facet = dictionary.get(condition.field);

  if (!facet) {
    return {
      error: {
        path,
        message: `unknown field "${condition.field}"`,
        nearMatches: nearMatches(condition.field, dictionary),
      },
    };
  }

  const operators = agentOperatorsFor(facet);

  if (!operators.includes(condition.op)) {
    return {
      error: {
        path,
        message: `${condition.field} supports ${operators.join(', ')}, not ${condition.op}`,
        example: exampleFor(condition.field),
        hint: facet.isArray ? ALL_OF_HINT : undefined,
      },
    };
  }

  if (looksLikeAllOf(facet, condition)) {
    return {
      error: {
        path,
        message: `${condition.field}: "${String((condition.value as string[])[0])}" looks like two values joined with "and"`,
        example: exampleFor(condition.field),
        hint: ALL_OF_HINT,
      },
    };
  }

  const normalised = normaliseValue(facet, condition.op, condition.value);

  if ('error' in normalised) {
    return {
      error: {
        path,
        message: `${condition.field}: ${normalised.error}`,
        example: exampleFor(condition.field),
      },
    };
  }

  // scalar columns are validated by the registry; array columns compile to overlap
  if (!facet.isArray && !PRESENCE_OPS.has(condition.op)) {
    const descriptor = operatorRegistry.resolve(facet.type, condition.op);

    if (!descriptor) {
      return {
        error: {
          path,
          message: `${condition.field}: operator ${condition.op} is not valid for a ${facet.type} field`,
          example: exampleFor(condition.field),
        },
      };
    }

    try {
      descriptor.parseValue(normalised.value);
    } catch {
      return {
        error: {
          path,
          message: `${condition.field}: value ${JSON.stringify(normalised.value)} is not valid for ${condition.op}`,
          example: exampleFor(condition.field),
        },
      };
    }
  }

  return {
    condition: {
      kind: 'condition',
      path: [{ attributeId: facet.attributeId }],
      operator: condition.op,
      value: normalised.value,
    },
  };
};

const combine = (kind: 'and' | 'or', parts: FilterTree[]): FilterTree | null =>
  parts.length === 0
    ? null
    : parts.length === 1
      ? (parts[0] as FilterTree)
      : { kind, children: parts };

/**
 * Turns the model's field-keyed filter into the FilterTree the prospecting
 * compiler already accepts: all → and, any → or, none → not(or). Never
 * throws: every problem is returned so the model can correct all of them in
 * one turn.
 */
export const compileAgentFilter = (
  filter: AgentFilter,
  dictionary: FieldDictionary,
): CompileAgentFilterResult => {
  const errors: AgentFilterError[] = [];
  const compiled: Record<AgentFilterGroup, FilterTree[]> = {
    all: [],
    any: [],
    none: [],
  };

  for (const group of ['all', 'any', 'none'] as const) {
    filter[group].forEach((condition, index) => {
      const result = compileCondition(
        condition,
        `${group}[${index}]`,
        dictionary,
      );

      if ('error' in result) {
        errors.push(result.error);
      } else {
        compiled[group].push(result.condition);
      }
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const groups: FilterTree[] = [...compiled.all];
  const any = combine('or', compiled.any);
  const none = combine('or', compiled.none);

  if (any) groups.push(any);
  if (none) groups.push({ kind: 'not', child: none });

  return { ok: true, tree: combine('and', groups) };
};
