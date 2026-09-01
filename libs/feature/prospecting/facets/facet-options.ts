import type { FacetDefinition, FacetOption } from './facet-definitions.js';

/**
 * A checkbox list stops being usable long before this. The cap is a classifier
 * rather than a display limit: a column with more distinct values than this is
 * not a vocabulary, so it becomes a lookup.
 */
export const OPTION_CAP = 200;

export type OptionRow = {
  allow_key: string;
  value: string;
  label: string;
};

/**
 * Options come from market.facet_option, built by the etl, so a request never
 * scans the projection.
 *
 * A lateral per column rather than a window function: counting a partition to
 * decide it is oversized means reading all 455,296 full names to learn that
 * there are too many. This reads at most the cap plus one from each.
 */
export const OPTIONS_SQL = `
SELECT k.allow_key, o.value, o.label
  FROM unnest($1::text[]) AS k(allow_key)
 CROSS JOIN LATERAL (
   SELECT value, label
     FROM market.facet_option f
    WHERE f.allow_key = k.allow_key
    ORDER BY f.position NULLS LAST, f.label
    LIMIT ${OPTION_CAP + 1}
 ) o`;

/**
 * A facet with more values than the cap becomes a lookup rather than shipping a
 * truncated list that silently hides the rest. This is what classifies names
 * and postal codes without anyone maintaining a list of them.
 */
export const attachOptions = (
  facets: FacetDefinition[],
  rows: readonly OptionRow[],
): FacetDefinition[] => {
  const byKey = new Map<string, FacetOption[]>();

  for (const row of rows) {
    const list = byKey.get(row.allow_key) ?? [];

    list.push({ value: row.value, label: row.label });
    byKey.set(row.allow_key, list);
  }

  return facets.map((facet) => {
    const options = byKey.get(facet.allowKey);

    if (!options) return facet;

    // the query asks for one more than the cap, so hitting it means there are more
    return options.length > OPTION_CAP
      ? { ...facet, kind: 'search' as const, options: [] }
      : { ...facet, options };
  });
};

/** prefix first, then anywhere: a recruiter typing "black" wants BlackRock */
export const SEARCH_OPTIONS_SQL = `
SELECT value, label
  FROM market.facet_option
 WHERE allow_key = $1
   AND label ILIKE $2
 ORDER BY (label ILIKE $3) DESC, row_count DESC, label
 LIMIT $4`;
