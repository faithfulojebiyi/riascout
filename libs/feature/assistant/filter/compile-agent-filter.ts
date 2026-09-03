import { ZodError } from 'zod';

import type {
  FilterCondition,
  FilterTree,
} from '@feature/entities/filter-sort/ast.js';
import { operatorRegistry } from '@feature/entities/filter-sort/operator-registry.js';
import type { FacetDefinition } from '@feature/prospecting/facets/facet-definitions.js';

import type { AgentCondition, AgentFilter } from './agent-filter.schema.js';
import type { FieldDictionary } from './field-dictionary.js';

export type AgentFilterError = {
  /** "all[0]" / "any[2]" so the model can point at the offending condition */
  path: string;
  message: string;
  nearMatches?: string[];
};

export type CompileAgentFilterResult =
  | { ok: true; tree: FilterTree | null }
  | { ok: false; errors: AgentFilterError[] };

const NEAR_MATCH_LIMIT = 5;
const PRESENCE_OPS = new Set(['isEmpty', 'isNotEmpty']);

const tokensOf = (key: string): string[] =>
  key
    .toLowerCase()
    .replace(/^(advisor|firm)\./, '')
    .split(/[._\s]+/)
    .filter((token) => token.length > 2);

/** token prefix overlap in either direction: "states" ~ "state", "aum" ~ "aum_band" */
const nearMatches = (field: string, dictionary: FieldDictionary): string[] => {
  const needleTokens = tokensOf(field);

  return [...dictionary.keys()]
    .filter((key) =>
      tokensOf(key).some((token) =>
        needleTokens.some(
          (needle) => token.startsWith(needle) || needle.startsWith(token),
        ),
      ),
    )
    .sort()
    .slice(0, NEAR_MATCH_LIMIT);
};

const isScalarArray = (value: unknown): value is (string | number)[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((item) => typeof item === 'string' || typeof item === 'number');

const validateValue = (
  facet: FacetDefinition,
  condition: AgentCondition,
): string | null => {
  if (PRESENCE_OPS.has(condition.op)) {
    return null;
  }

  // array columns compile to overlap and accept any scalar list; see compileReference
  if (facet.isArray) {
    return isScalarArray(condition.value)
      ? null
      : 'array fields take a non-empty array of values';
  }

  const descriptor = operatorRegistry.resolve(facet.type, condition.op);

  if (!descriptor) {
    return `operator ${condition.op} is not valid for a ${facet.type} field`;
  }

  try {
    descriptor.parseValue(condition.value);

    return null;
  } catch (error) {
    return error instanceof ZodError
      ? error.issues.map((issue) => issue.message).join('; ')
      : 'invalid value';
  }
};

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

  if (!facet.operators.includes(condition.op)) {
    return {
      error: {
        path,
        message: `${condition.field} supports ${facet.operators.join(', ')}, not ${condition.op}`,
      },
    };
  }

  const valueError = validateValue(facet, condition);

  if (valueError) {
    return {
      error: { path, message: `${condition.field}: ${valueError}` },
    };
  }

  return {
    condition: {
      kind: 'condition',
      path: [{ attributeId: facet.attributeId }],
      operator: condition.op,
      value: PRESENCE_OPS.has(condition.op) ? null : condition.value,
    },
  };
};

/**
 * Turns the model's field-keyed filter into the FilterTree the prospecting
 * compiler already accepts. Never throws: every problem is returned so the
 * model can correct all of them in one turn.
 */
export const compileAgentFilter = (
  filter: AgentFilter,
  dictionary: FieldDictionary,
): CompileAgentFilterResult => {
  const errors: AgentFilterError[] = [];
  const all: FilterTree[] = [];
  const any: FilterTree[] = [];

  const collect = (
    conditions: AgentCondition[],
    group: 'all' | 'any',
    into: FilterTree[],
  ): void => {
    conditions.forEach((condition, index) => {
      const result = compileCondition(
        condition,
        `${group}[${index}]`,
        dictionary,
      );

      if ('error' in result) {
        errors.push(result.error);
      } else {
        into.push(result.condition);
      }
    });
  };

  collect(filter.all, 'all', all);
  collect(filter.any, 'any', any);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const groups: FilterTree[] = [...all];

  if (any.length === 1) {
    groups.push(any[0] as FilterTree);
  } else if (any.length > 1) {
    groups.push({ kind: 'or', children: any });
  }

  if (groups.length === 0) {
    return { ok: true, tree: null };
  }

  return {
    ok: true,
    tree:
      groups.length === 1
        ? (groups[0] as FilterTree)
        : { kind: 'and', children: groups },
  };
};
