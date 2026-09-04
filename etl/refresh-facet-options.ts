import { Client } from 'pg';

import { REFERENCE_COLUMNS } from '../libs/feature/entities/attribute-types/reference-columns.js';
import {
  facetKindFor,
  DIM_SOURCE,
  LABEL_SOURCE,
} from '../libs/feature/prospecting/facets/facet-kinds.js';

/**
 * Rebuilds market.facet_option from the allowlist rather than a list of columns
 * kept in SQL. A column added to the allowlist gets its options here with no
 * further edit; a hand-kept copy would drift the first time one changed.
 *
 * Every enumerable facet is included, not just the small ones. The endpoint
 * decides what to inline and what to look up; this only has to be complete.
 */
/**
 * Dims whose values have a natural order. An AUM band sorts by magnitude, and
 * neither "$1B – $5B" nor 1b_5b does — alphabetically $100M lands before $1B.
 * A dim absent here keeps NULL and is ordered by label.
 */
const ORDER_BY_DIM: Readonly<Record<string, string>> = {
  dim_aum_band: 'lower_aum NULLS FIRST',
  dim_ownership_code: 'lower_pct NULLS FIRST',
};

export const refreshFacetOptions = async (
  connectionString: string,
): Promise<{ columns: number; options: number }> => {
  const client = new Client({ connectionString });

  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE market.facet_option');

    let columns = 0;
    let options = 0;

    for (const [allowKey, ref] of REFERENCE_COLUMNS) {
      const kind = facetKindFor(ref);

      if (kind !== 'multiSelect' && kind !== 'search') continue;

      const dim = DIM_SOURCE[allowKey];
      const labelled = LABEL_SOURCE[allowKey];

      /**
       * A dim table is authoritative and carries a display label, and it also
       * lists values that have no rows yet — which a scan of the projection
       * cannot do.
       */
      const order = dim ? ORDER_BY_DIM[dim] : undefined;
      const position = order
        ? `row_number() OVER (ORDER BY ${order})::int`
        : 'NULL::int';

      const source = dim
        ? `SELECT code::text AS value, name::text AS label, 0 AS row_count,
                  ${position} AS position
             FROM market.${dim}`
        : ref.isArray && labelled
          ? `SELECT v::text AS value,
                    coalesce(d.${labelled.label}::text, v::text) AS label,
                    count(*)::int AS row_count, NULL::int AS position
               FROM market.${ref.source}, unnest(${ref.column}) AS v
               LEFT JOIN market.${labelled.table} d ON d.${labelled.id} = v
              WHERE v IS NOT NULL
              GROUP BY v, d.${labelled.label}`
          : ref.isArray
            ? `SELECT v::text AS value, v::text AS label, count(*)::int AS row_count,
                    NULL::int AS position
               FROM market.${ref.source}, unnest(${ref.column}) AS v
              WHERE v IS NOT NULL
              GROUP BY v`
            : `SELECT ${ref.column}::text AS value, ${ref.column}::text AS label,
                    count(*)::int AS row_count, NULL::int AS position
               FROM market.${ref.source}
              WHERE ${ref.column} IS NOT NULL
              GROUP BY ${ref.column}`;

      const result = await client.query(
        `INSERT INTO market.facet_option (allow_key, value, label, row_count, position)
         SELECT $1, value, label, row_count, position FROM (${source}) s
         ON CONFLICT (allow_key, value) DO NOTHING`,
        [allowKey],
      );

      columns += 1;
      options += result.rowCount ?? 0;
    }

    await client.query('COMMIT');

    return { columns, options };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
};
