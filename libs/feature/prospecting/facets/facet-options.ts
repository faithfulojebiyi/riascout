import { resolveReferenceColumn } from '@feature/entities/attribute-types/reference-columns.js';

import type { FacetDefinition, FacetOption } from './facet-definitions.js';
import { DIM_SOURCE } from './facet-kinds.js';

/**
 * A checkbox list stops being usable long before this, but the cap is a
 * classifier rather than a display limit: anything reaching it is not a
 * vocabulary and gets demoted to a lookup.
 */
export const OPTION_CAP = 200;

export type OptionQuery = { sql: string; keys: string[] };

/**
 * One statement for every multiSelect facet rather than one per column, each
 * capped so a high-cardinality column cannot drag back half a million rows —
 * full_name alone has 455,296 distinct values.
 *
 * The option sets are global reference data, identical for every workspace, so
 * this wants a cache in front of it.
 */
export const buildOptionQuery = (
  facets: readonly FacetDefinition[],
): OptionQuery | null => {
  const parts: string[] = [];
  const keys: string[] = [];

  for (const facet of facets) {
    if (facet.kind !== 'multiSelect') continue;

    const ref = resolveReferenceColumn(facet.allowKey);

    if (!ref) continue;

    const dim = DIM_SOURCE[facet.allowKey];
    const idx = keys.length;

    keys.push(facet.allowKey);

    /**
     * A dim table is authoritative and carries a display name, so prefer it: it
     * also lists values with no rows yet, which a distinct scan cannot.
     * Everything casts to text; custodian ids are int[] and would not union.
     */
    const source = dim
      ? `SELECT code::text AS value, name::text AS label FROM market.${dim}`
      : facet.isArray
        ? `SELECT DISTINCT unnest(${ref.column})::text AS value,
                  unnest(${ref.column})::text AS label
             FROM market.${ref.source}`
        : `SELECT DISTINCT ${ref.column}::text AS value,
                  ${ref.column}::text AS label
             FROM market.${ref.source}`;

    // parenthesised: a bare LIMIT inside a UNION ALL branch binds to the union
    parts.push(
      `(SELECT ${idx} AS k, value, label
          FROM (${source}) s${idx}
         WHERE value IS NOT NULL
         LIMIT ${OPTION_CAP + 1})`,
    );
  }

  return parts.length > 0
    ? { sql: `${parts.join('\nUNION ALL\n')}\nORDER BY 1, 3`, keys }
    : null;
};

/**
 * A facet that hit the cap is not enumerable, so it becomes a lookup rather
 * than shipping a truncated list that silently hides values. This is what
 * classifies names and postal codes without a hand-maintained list of them.
 */
export const attachOptions = (
  facets: FacetDefinition[],
  rows: readonly { k: number; value: string; label: string }[],
  keys: readonly string[],
): FacetDefinition[] => {
  const byKey = new Map<string, FacetOption[]>();

  for (const row of rows) {
    const allowKey = keys[Number(row.k)];

    if (!allowKey || row.value === null) continue;

    const list = byKey.get(allowKey) ?? [];

    list.push({ value: String(row.value), label: String(row.label) });
    byKey.set(allowKey, list);
  }

  return facets.map((facet) => {
    const options = byKey.get(facet.allowKey);

    if (!options) return facet;

    return options.length > OPTION_CAP
      ? { ...facet, kind: 'search' as const, options: [] }
      : { ...facet, options };
  });
};
