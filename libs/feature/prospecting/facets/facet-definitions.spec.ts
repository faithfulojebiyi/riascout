import { describe, expect, it } from 'vitest';

import { buildFacetDefinitions } from './facet-definitions.js';
import {
  attachOptions,
  buildOptionQuery,
  OPTION_CAP,
} from './facet-options.js';

const attr = (id: string, referenceColumn: string) => ({
  id,
  label: id,
  icon: null,
  referenceColumn,
});

describe('buildFacetDefinitions', () => {
  it('derives a facet kind per column type', () => {
    const facets = buildFacetDefinitions([
      attr('a', 'advisor.state'),
      attr('b', 'advisor.tenure_years'),
      attr('c', 'advisor.is_active'),
      attr('d', 'advisor.current_firm_since'),
    ]);

    expect(facets.map((f) => f.kind)).toEqual([
      'multiSelect',
      'number',
      'boolean',
      'date',
    ]);
  });

  it('gives array columns of text a multi-select', () => {
    const [facet] = buildFacetDefinitions([attr('a', 'advisor.exam_codes')]);

    expect(facet?.kind).toBe('multiSelect');
    expect(facet?.isArray).toBe(true);
  });

  /** 61,000 CRDs is a lookup, not a checkbox list */
  it('treats a numeric identifier array as a lookup', () => {
    const [facet] = buildFacetDefinitions([
      attr('a', 'advisor.previous_firm_crds'),
    ]);

    expect(facet?.kind).toBe('search');
  });

  it('gives a url no facet at all', () => {
    expect(
      buildFacetDefinitions([attr('a', 'advisor.firm_linkedin_url')]),
    ).toEqual([]);
  });

  it('drops a column that is not in the allowlist', () => {
    expect(buildFacetDefinitions([attr('a', 'advisor.nonexistent')])).toEqual(
      [],
    );
  });
});

describe('buildOptionQuery', () => {
  it('caps every branch so one wide column cannot dominate', () => {
    const facets = buildFacetDefinitions([attr('a', 'advisor.state')]);
    const query = buildOptionQuery(facets);

    expect(query?.sql).toContain(`LIMIT ${OPTION_CAP + 1}`);
  });

  it('parenthesises branches, since a bare limit binds to the union', () => {
    const facets = buildFacetDefinitions([
      attr('a', 'advisor.state'),
      attr('b', 'advisor.exam_codes'),
    ]);
    const query = buildOptionQuery(facets);

    expect(query?.sql).toContain('UNION ALL');
    expect(query?.sql.trimStart().startsWith('(')).toBe(true);
  });

  it('prefers a dim table, which also lists values with no rows yet', () => {
    const facets = buildFacetDefinitions([attr('a', 'advisor.firm_aum_band')]);

    expect(buildOptionQuery(facets)?.sql).toContain('market.dim_aum_band');
  });

  it('has nothing to ask when no facet enumerates', () => {
    const facets = buildFacetDefinitions([attr('a', 'advisor.tenure_years')]);

    expect(buildOptionQuery(facets)).toBeNull();
  });
});

describe('attachOptions', () => {
  const facets = buildFacetDefinitions([attr('a', 'advisor.state')]);

  it('attaches options under the cap', () => {
    const result = attachOptions(
      facets,
      [{ k: 0, value: 'CA', label: 'CA' }],
      ['advisor.state'],
    );

    expect(result[0]?.kind).toBe('multiSelect');
    expect(result[0]?.options).toEqual([{ value: 'CA', label: 'CA' }]);
  });

  /** what classifies full_name, without anyone maintaining a list of names */
  it('demotes a facet that hit the cap rather than truncating it', () => {
    const rows = Array.from({ length: OPTION_CAP + 1 }, (_, i) => ({
      k: 0,
      value: `v${i}`,
      label: `v${i}`,
    }));

    const result = attachOptions(facets, rows, ['advisor.state']);

    expect(result[0]?.kind).toBe('search');
    expect(result[0]?.options).toEqual([]);
  });
});
