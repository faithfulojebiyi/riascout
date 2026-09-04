import type {
  FacetDefinition,
  FacetSelection,
  FacetValue,
  FilterOperator,
} from '../types/prospecting';
import type { AgentCondition, AgentFilter } from './agent-filter-url';

export type HydratedSelection = {
  selection: FacetSelection;
  /** conditions the rail cannot show, named so the count is never silently off */
  unmapped: string[];
};

const describe = (condition: AgentCondition, prefix = ''): string => {
  const value = Array.isArray(condition.value)
    ? condition.value.join(', ')
    : condition.value === undefined
      ? ''
      : String(condition.value);

  return `${prefix}${condition.field} ${condition.op} ${value}`.trim();
};

const isNumberPair = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((v) => typeof v === 'number');

const toStrings = (value: unknown): string[] | null => {
  const list = Array.isArray(value) ? value : [value];

  return list.every((v) => typeof v === 'string' || typeof v === 'number')
    ? list.map(String)
    : null;
};

/** one condition to the value its facet control would have produced */
const toFacetValue = (
  facet: FacetDefinition,
  condition: AgentCondition,
): FacetValue | null => {
  if (!facet.operators.includes(condition.op)) return null;

  const operator = condition.op as FilterOperator;
  const { value } = condition;

  switch (facet.kind) {
    case 'multiSelect':
    case 'search': {
      if (operator !== 'isAnyOf' && operator !== 'isNoneOf') return null;

      const values = toStrings(value);

      return values && values.length > 0
        ? { kind: 'multiSelect', operator, values }
        : null;
    }
    case 'boolean':
      return operator === 'is' && typeof value === 'boolean'
        ? { kind: 'boolean', value }
        : null;
    case 'number':
      if (operator === 'isBetween') {
        return isNumberPair(value) ? { kind: 'number', operator, value } : null;
      }

      return typeof value === 'number'
        ? { kind: 'number', operator, value }
        : null;
    case 'date':
      if (operator === 'isWithinLastNDays') {
        return typeof value === 'number'
          ? { kind: 'date', operator, value }
          : null;
      }

      return typeof value === 'string'
        ? { kind: 'date', operator, value }
        : null;
    default:
      return null;
  }
};

/**
 * The rail is a flat AND of one value per facet, so only `all` maps, one
 * condition per field. Everything else is reported, never approximated.
 */
export const toFacetSelection = (
  filter: AgentFilter,
  facets: FacetDefinition[],
): HydratedSelection => {
  const byKey = new Map(facets.map((facet) => [facet.allowKey, facet]));
  const selection: FacetSelection = {};
  const unmapped: string[] = [];

  for (const condition of filter.all) {
    const facet = byKey.get(condition.field);
    const value = facet ? toFacetValue(facet, condition) : null;

    if (!facet || !value || selection[facet.attributeId]) {
      unmapped.push(describe(condition));
      continue;
    }

    selection[facet.attributeId] = value;
  }

  unmapped.push(
    ...filter.any.map((c) => describe(c, 'any of: ')),
    ...filter.none.map((c) => describe(c, 'none of: ')),
  );

  return { selection, unmapped };
};

/** the rail's state as the assistant's language, so any rail state is shareable */
export const toAgentFilter = (
  selection: FacetSelection,
  facets: FacetDefinition[],
): AgentFilter | null => {
  const byId = new Map(facets.map((facet) => [facet.attributeId, facet]));
  const all: AgentCondition[] = [];

  for (const [attributeId, value] of Object.entries(selection)) {
    const facet = byId.get(attributeId);

    if (!facet) continue;

    switch (value.kind) {
      case 'multiSelect':
        if (value.values.length > 0) {
          all.push({
            field: facet.allowKey,
            op: value.operator,
            value: value.values,
          });
        }
        break;
      case 'boolean':
        all.push({ field: facet.allowKey, op: 'is', value: value.value });
        break;
      case 'number':
      case 'date':
        all.push({
          field: facet.allowKey,
          op: value.operator,
          value: value.value,
        });
        break;
    }
  }

  return all.length > 0 ? { all, any: [], none: [] } : null;
};
