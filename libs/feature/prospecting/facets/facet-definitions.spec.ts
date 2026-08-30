import { describe, expect, it } from 'vitest';

import { buildFacetDefinitions } from './facet-definitions.js';
import { attachOptions, OPTION_CAP } from './facet-options.js';

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

describe('attachOptions', () => {
  const facets = buildFacetDefinitions([attr('a', 'advisor.state')]);

  it('attaches options under the cap', () => {
    const result = attachOptions(facets, [
      { allow_key: 'advisor.state', value: 'CA', label: 'CA' },
    ]);

    expect(result[0]?.kind).toBe('multiSelect');
    expect(result[0]?.options).toEqual([{ value: 'CA', label: 'CA' }]);
  });

  /** what classifies full_name, without anyone maintaining a list of names */
  it('demotes a facet that hit the cap rather than truncating it', () => {
    const rows = Array.from({ length: OPTION_CAP + 1 }, (_, i) => ({
      allow_key: 'advisor.state',
      value: `v${i}`,
      label: `v${i}`,
    }));

    const result = attachOptions(facets, rows);

    expect(result[0]?.kind).toBe('search');
    expect(result[0]?.options).toEqual([]);
  });
});
