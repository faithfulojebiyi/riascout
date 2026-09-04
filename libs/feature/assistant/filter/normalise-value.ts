import type { FilterOperator } from '@feature/entities/filter-sort/ast.js';
import type { FacetDefinition } from '@feature/prospecting/facets/facet-definitions.js';

export type NormalisedValue = { value: unknown } | { error: string };

const NUMERIC_TYPES = new Set(['number', 'currency', 'percentage', 'rating']);
const RANGE_OPS = new Set<FilterOperator>(['isBetween']);
const LIST_OPS = new Set<FilterOperator>(['isAnyOf', 'isNoneOf']);
const SCALE: Record<string, number> = {
  k: 1e3,
  m: 1e6,
  mm: 1e6,
  mn: 1e6,
  b: 1e9,
  bn: 1e9,
  t: 1e12,
  tn: 1e12,
};

/** "$2B", "1.5m", "2,000,000", "15%" and plain numbers all become a number */
export const parseAmount = (raw: unknown): number | null => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;

  const text = raw
    .trim()
    .toLowerCase()
    .replace(/[$,\s]/g, '');
  const match = /^(-?\d+(?:\.\d+)?)(k|mm|mn|m|bn|b|tn|t|%)?$/.exec(text);

  if (!match) return null;

  const base = Number(match[1]);
  const suffix = match[2];

  if (!Number.isFinite(base)) return null;
  if (suffix === '%') return base / 100;

  return suffix ? base * (SCALE[suffix] ?? 1) : base;
};

const parseDate = (raw: unknown): string | null => {
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw !== 'string') return null;

  const text = raw.trim();

  if (/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(text)) return text;
  // "2026-01" means the first of that month
  if (/^\d{4}-\d{2}$/.test(text)) return `${text}-01`;

  return null;
};

const parseBoolean = (raw: unknown): boolean | null => {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw !== 'string') return null;

  const text = raw.trim().toLowerCase();

  if (['true', 'yes', 'y', '1'].includes(text)) return true;
  if (['false', 'no', 'n', '0'].includes(text)) return false;

  return null;
};

const asPair = (raw: unknown): [unknown, unknown] | null => {
  if (Array.isArray(raw) && raw.length === 2) return [raw[0], raw[1]];

  if (typeof raw === 'object' && raw !== null) {
    const record = raw as Record<string, unknown>;
    const lo = record.min ?? record.from ?? record.low;
    const hi = record.max ?? record.to ?? record.high;

    if (lo !== undefined && hi !== undefined) return [lo, hi];
  }

  return null;
};

const normaliseScalar = (
  facet: FacetDefinition,
  raw: unknown,
): { value: unknown } | { error: string } => {
  if (NUMERIC_TYPES.has(facet.type)) {
    const amount = parseAmount(raw);

    return amount === null
      ? { error: `expected a number, got ${JSON.stringify(raw)}` }
      : { value: facet.type === 'percentage' ? amount : amount };
  }

  if (facet.type === 'date' || facet.type === 'timestamp') {
    const date = parseDate(raw);

    return date === null
      ? {
          error: `expected an ISO date (YYYY-MM-DD), got ${JSON.stringify(raw)}`,
        }
      : { value: date };
  }

  if (facet.type === 'boolean' || facet.type === 'checkbox') {
    const flag = parseBoolean(raw);

    return flag === null
      ? { error: `expected true or false, got ${JSON.stringify(raw)}` }
      : { value: flag };
  }

  return typeof raw === 'string' || typeof raw === 'number'
    ? { value: String(raw) }
    : { error: `expected text, got ${JSON.stringify(raw)}` };
};

/**
 * Coerces what the model sent into what the operator registry expects. The
 * prompt asks for numbers and ISO dates; this is the safety net for "$2B",
 * "2026-01", { min, max } and a bare scalar where a list was meant.
 */
export const normaliseValue = (
  facet: FacetDefinition,
  op: FilterOperator,
  raw: unknown,
): NormalisedValue => {
  if (op === 'isEmpty' || op === 'isNotEmpty') {
    return { value: null };
  }

  if (op === 'isWithinLastNDays') {
    const days = parseAmount(raw);

    return days === null || days < 1 || !Number.isInteger(days)
      ? {
          error: `expected a positive whole number of days, got ${JSON.stringify(raw)}`,
        }
      : { value: days };
  }

  if (RANGE_OPS.has(op)) {
    const pair = asPair(raw);

    if (!pair) {
      return { error: 'isBetween takes [low, high]' };
    }

    const lo = normaliseScalar(facet, pair[0]);
    const hi = normaliseScalar(facet, pair[1]);

    if ('error' in lo) return lo;
    if ('error' in hi) return hi;

    if (
      typeof lo.value === 'number' &&
      typeof hi.value === 'number' &&
      lo.value > hi.value
    ) {
      return { error: 'isBetween range is reversed: low must not exceed high' };
    }

    return { value: [lo.value, hi.value] };
  }

  if (LIST_OPS.has(op) || facet.isArray) {
    const items = Array.isArray(raw) ? raw : [raw];

    if (items.length === 0) {
      return { error: 'expected at least one value' };
    }

    const out: unknown[] = [];

    for (const item of items) {
      // numeric arrays (CRDs) keep numbers; text lists stay text
      const one = facet.isArray
        ? normaliseScalar(facet, item)
        : typeof item === 'string' || typeof item === 'number'
          ? { value: String(item) }
          : { error: `expected text values, got ${JSON.stringify(item)}` };

      if ('error' in one) return one;

      out.push(one.value);
    }

    return { value: out };
  }

  return normaliseScalar(facet, raw);
};
