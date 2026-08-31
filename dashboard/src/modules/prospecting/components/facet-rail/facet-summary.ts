import type { FacetDefinition, FacetValue } from '../../types/prospecting';

const OPERATOR_LABEL: Record<string, string> = {
  isAfter: 'after',
  isBefore: 'before',
  isBetween: 'between',
  isGreaterThan: '>',
  isLessThan: '<',
  isNot: 'not',
  isNoneOf: 'none of',
  isWithinLastNDays: 'last',
};

const MAX_VALUES = 2;

/**
 * What a collapsed row shows, so an applied filter is legible without opening
 * it. Labels come from the facet's own options — a raw stored value like a
 * state code is fine, an opaque id is not.
 */
export const facetSummary = (
  facet: FacetDefinition,
  value: FacetValue | undefined,
): string | null => {
  if (!value) return null;

  if (value.kind === 'boolean') {
    return value.value ? 'Yes' : 'No';
  }

  if (value.kind === 'multiSelect') {
    if (value.values.length === 0) return null;

    const labelFor = (raw: string) =>
      facet.options.find((option) => option.value === raw)?.label ?? raw;

    const shown = value.values.slice(0, MAX_VALUES).map(labelFor).join(', ');
    const rest = value.values.length - MAX_VALUES;

    return rest > 0 ? `${shown} +${rest}` : shown;
  }

  const operator = OPERATOR_LABEL[value.operator] ?? '';

  if (value.kind === 'number') {
    const rendered = Array.isArray(value.value)
      ? `${value.value[0].toLocaleString()}–${value.value[1].toLocaleString()}`
      : value.value.toLocaleString();

    return `${operator} ${rendered}`.trim();
  }

  return `${operator} ${value.value}`.trim();
};
