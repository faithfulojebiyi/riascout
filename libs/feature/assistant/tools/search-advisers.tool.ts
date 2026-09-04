import { z } from 'zod';

import { openUrlFor } from '../filter/agent-filter-url.js';
import { defineTool } from './define-tool.js';
import {
  asNumber,
  asString,
  extrasFor,
  filterErrorSchema,
  labelFor,
  prospectSearchInputSchema,
  runProspectSearch,
} from './prospect-search.js';

export const ADVISER_OPEN_URL = '/prospecting/advisors';

/** the columns every result row carries; allowlist keys, resolved per workspace */
const DEFAULT_KEYS = [
  'advisor.full_name',
  'advisor.current_firm_crd',
  'advisor.current_firm_name',
  'advisor.state',
  'advisor.firm_aum_band',
  'advisor.tenure_years',
  'advisor.last_moved_on',
] as const;

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
  lastMovedOn: z.string().nullable(),
  /** set when the adviser is already saved as a record in this workspace */
  savedRecordId: z.string().nullable(),
  /** values of the extra `columns` requested, keyed by field key */
  extra: z.record(z.string(), z.unknown()),
});

const outputSchema = z.object({
  total: z.number().int(),
  rows: z.array(adviserRowSchema),
  /** the filter that produced these rows, echoed for saving and linking */
  filter: z.unknown().nullable(),
  reading: z.string().nullable(),
  /** the dashboard page with this filter applied, or the bare page if it would not fit a url */
  openUrl: z.string(),
  openUrlCarriesFilter: z.boolean(),
  filterErrors: z.array(filterErrorSchema).optional(),
});

export const searchAdvisersTool = defineTool({
  id: 'search_advisers',
  scope: 'read',
  approval: false,
  description: [
    'Search the adviser database (510k SEC-registered advisers) with a structured filter.',
    'Fields, operators and option values come from the adviser section of the field dictionary; use the option value, not the label, and send numbers as numbers.',
    'Returns the total match count and up to 25 preview rows; set countOnly for a bare count, sort to rank the preview, columns to add up to 6 extra fields.',
    'If filterErrors is returned, fix every listed condition and call again. Quote CRDs with names.',
  ].join(' '),
  input: prospectSearchInputSchema,
  output: outputSchema,
  toModelOutput: (output) => ({
    total: output.total,
    shown: output.rows.length,
    rows: output.rows.slice(0, 10).map((row) => ({
      advisorCrd: row.advisorCrd,
      fullName: row.fullName,
      firm: row.firmName ? `${row.firmName} (${row.firmCrd ?? '?'})` : null,
      state: row.state,
      firmAum: row.firmAumBandLabel ?? row.firmAumBand,
      tenureYears: row.tenureYears,
      lastMovedOn: row.lastMovedOn,
      ...(Object.keys(row.extra).length > 0 ? { extra: row.extra } : {}),
    })),
    reading: output.reading,
    filterErrors: output.filterErrors,
  }),
  execute: async (input, ctx) => {
    const outcome = await runProspectSearch(
      input,
      'advisor',
      DEFAULT_KEYS,
      ctx,
    );

    if (!outcome.ok) {
      return {
        total: 0,
        rows: [],
        filter: input.filter,
        reading: input.reading ?? null,
        openUrl: ADVISER_OPEN_URL,
        openUrlCarriesFilter: false,
        filterErrors: outcome.filterErrors,
      };
    }

    return {
      total: outcome.total,
      filter: outcome.filter,
      reading: input.reading ?? null,
      ...openUrlFor(ADVISER_OPEN_URL, outcome.filter),
      rows: outcome.rows.map((row) => {
        const firmAumBand = asString(row.byKey.get('advisor.firm_aum_band'));

        return {
          advisorCrd: row.sourceCrd,
          fullName: asString(row.byKey.get('advisor.full_name')),
          firmCrd: asString(row.byKey.get('advisor.current_firm_crd')),
          firmName: asString(row.byKey.get('advisor.current_firm_name')),
          state: asString(row.byKey.get('advisor.state')),
          firmAumBand,
          firmAumBandLabel: labelFor(
            outcome.dictionary,
            'advisor.firm_aum_band',
            firmAumBand,
          ),
          tenureYears: asNumber(row.byKey.get('advisor.tenure_years')),
          lastMovedOn: asString(row.byKey.get('advisor.last_moved_on')),
          savedRecordId: row.recordId,
          extra: extrasFor(row, input.columns),
        };
      }),
    };
  },
});
