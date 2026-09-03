import { z } from 'zod';

import { agentFilterSchema } from '../filter/agent-filter.schema.js';
import { compileAgentFilter } from '../filter/compile-agent-filter.js';
import { buildFieldDictionary } from '../filter/field-dictionary.js';
import { defineTool } from './define-tool.js';

export const SEARCH_ADVISERS_MAX = 25;

/** the columns every result row carries; allowlist keys, resolved per workspace */
const DEFAULT_SELECT_KEYS = [
  'advisor.full_name',
  'advisor.current_firm_crd',
  'advisor.current_firm_name',
  'advisor.state',
  'advisor.firm_aum_band',
  'advisor.tenure_years',
  'advisor.last_detected_on',
] as const;

type SelectKey = (typeof DEFAULT_SELECT_KEYS)[number];

const asString = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
};

const adviserRowSchema = z.object({
  advisorCrd: z.string(),
  fullName: z.string().nullable(),
  firmCrd: z.string().nullable(),
  firmName: z.string().nullable(),
  state: z.string().nullable(),
  firmAumBand: z.string().nullable(),
  /** the band's display label from the facet options, e.g. "$1B – $5B" */
  firmAumBandLabel: z.string().nullable(),
  tenureYears: z.number().nullable(),
  lastDetectedOn: z.string().nullable(),
  /** set when the adviser is already saved as a record in this workspace */
  savedRecordId: z.string().nullable(),
});

export const searchAdvisersTool = defineTool({
  id: 'search_advisers',
  scope: 'read',
  approval: false,
  description: [
    'Search the adviser database (510k SEC-registered advisers) with a structured filter.',
    'Fields, operators and option values come from the field dictionary in your instructions; use the option value, not the label.',
    'Returns the total match count and up to 25 preview rows. Quote CRDs with names.',
    'If filterErrors is returned, fix every listed condition and call again.',
  ].join(' '),
  input: z.object({
    filter: agentFilterSchema
      .nullable()
      .describe('null returns the whole population count'),
    limit: z.number().int().min(1).max(SEARCH_ADVISERS_MAX).default(10),
  }),
  output: z.object({
    total: z.number().int(),
    rows: z.array(adviserRowSchema),
    /** the dashboard page where the recruiter can continue with the full grid */
    openUrl: z.string(),
    filterErrors: z
      .array(
        z.object({
          path: z.string(),
          message: z.string(),
          nearMatches: z.array(z.string()).optional(),
        }),
      )
      .optional(),
  }),
  execute: async (input, { queries, identity }) => {
    const openUrl = '/prospecting/advisors';
    const facets = await queries.getFacets(identity, 'advisor');
    const dictionary = buildFieldDictionary(facets);

    const compiled = input.filter
      ? compileAgentFilter(input.filter, dictionary)
      : { ok: true as const, tree: null };

    if (!compiled.ok) {
      return { total: 0, rows: [], openUrl, filterErrors: compiled.errors };
    }

    const selected = DEFAULT_SELECT_KEYS.flatMap((key) => {
      const facet = dictionary.get(key);

      return facet ? [{ key, attributeId: facet.attributeId }] : [];
    });
    const keyByAttributeId = new Map(
      selected.map(({ key, attributeId }) => [attributeId, key]),
    );
    const bandLabels = new Map(
      (dictionary.get('advisor.firm_aum_band')?.options ?? []).map((option) => [
        option.value,
        option.label,
      ]),
    );

    const result = await queries.searchAdvisors(identity, {
      sourceKind: 'advisor',
      filter: compiled.tree,
      sort: [],
      selectAttributeIds: selected.map(({ attributeId }) => attributeId),
      limit: input.limit,
      offset: 0,
    });

    return {
      total: result.total,
      openUrl,
      rows: result.rows.map((row) => {
        const byKey = new Map<SelectKey, unknown>();

        for (const { attributeId, value } of row.values) {
          const key = keyByAttributeId.get(attributeId);

          if (key) byKey.set(key, value);
        }

        const firmAumBand = asString(byKey.get('advisor.firm_aum_band'));

        return {
          advisorCrd: row.sourceCrd,
          fullName: asString(byKey.get('advisor.full_name')),
          firmCrd: asString(byKey.get('advisor.current_firm_crd')),
          firmName: asString(byKey.get('advisor.current_firm_name')),
          state: asString(byKey.get('advisor.state')),
          firmAumBand,
          firmAumBandLabel:
            firmAumBand === null ? null : (bandLabels.get(firmAumBand) ?? null),
          tenureYears: asNumber(byKey.get('advisor.tenure_years')),
          lastDetectedOn: asString(byKey.get('advisor.last_detected_on')),
          savedRecordId: row.recordId,
        };
      }),
    };
  },
});
