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

export const FIRM_OPEN_URL = '/prospecting/firms';

const DEFAULT_KEYS = [
  'firm.firm_name',
  'firm.state',
  'firm.channel_code',
  'firm.regulatory_aum',
  'firm.aum_band',
  'firm.advisor_count',
  'firm.net_advisor_flow_90d',
] as const;

const firmRowSchema = z.object({
  firmCrd: z.string(),
  firmName: z.string().nullable(),
  state: z.string().nullable(),
  channelCode: z.string().nullable(),
  channelLabel: z.string().nullable(),
  /** decimal string; null means the filing did not report it */
  regulatoryAum: z.string().nullable(),
  aumBand: z.string().nullable(),
  aumBandLabel: z.string().nullable(),
  advisorCount: z.number().nullable(),
  netAdvisorFlow90d: z.number().nullable(),
  savedRecordId: z.string().nullable(),
  extra: z.record(z.string(), z.unknown()),
});

const outputSchema = z.object({
  total: z.number().int(),
  rows: z.array(firmRowSchema),
  filter: z.unknown().nullable(),
  reading: z.string().nullable(),
  /** the dashboard page with this filter applied, or the bare page if it would not fit a url */
  openUrl: z.string(),
  openUrlCarriesFilter: z.boolean(),
  filterErrors: z.array(filterErrorSchema).optional(),
});

export const searchFirmsTool = defineTool({
  id: 'search_firms',
  scope: 'read',
  approval: false,
  description: [
    'Search SEC-registered firms (61k) with a structured filter over the firm section of the field dictionary.',
    'Use it when the unit of the question is the firm: size, growth, channel, headcount, attrition. Use search_advisers when the answer is people.',
    'Returns the total and up to 25 preview rows; countOnly, sort and columns work as in search_advisers. Quote CRDs with names.',
  ].join(' '),
  input: prospectSearchInputSchema,
  output: outputSchema,
  toModelOutput: (output) => ({
    total: output.total,
    shown: output.rows.length,
    rows: output.rows.slice(0, 10).map((row) => ({
      firmCrd: row.firmCrd,
      firmName: row.firmName,
      state: row.state,
      channel: row.channelLabel ?? row.channelCode,
      regulatoryAum: row.regulatoryAum,
      advisorCount: row.advisorCount,
      netAdvisorFlow90d: row.netAdvisorFlow90d,
      ...(Object.keys(row.extra).length > 0 ? { extra: row.extra } : {}),
    })),
    reading: output.reading,
    filterErrors: output.filterErrors,
  }),
  execute: async (input, ctx) => {
    const outcome = await runProspectSearch(input, 'firm', DEFAULT_KEYS, ctx);

    if (!outcome.ok) {
      return {
        total: 0,
        rows: [],
        filter: input.filter,
        reading: input.reading ?? null,
        openUrl: FIRM_OPEN_URL,
        openUrlCarriesFilter: false,
        filterErrors: outcome.filterErrors,
      };
    }

    return {
      total: outcome.total,
      filter: outcome.filter,
      reading: input.reading ?? null,
      ...openUrlFor(FIRM_OPEN_URL, outcome.filter),
      rows: outcome.rows.map((row) => {
        const channelCode = asString(row.byKey.get('firm.channel_code'));
        const aumBand = asString(row.byKey.get('firm.aum_band'));

        return {
          firmCrd: row.sourceCrd,
          firmName: asString(row.byKey.get('firm.firm_name')),
          state: asString(row.byKey.get('firm.state')),
          channelCode,
          channelLabel: labelFor(
            outcome.dictionary,
            'firm.channel_code',
            channelCode,
          ),
          regulatoryAum: asString(row.byKey.get('firm.regulatory_aum')),
          aumBand,
          aumBandLabel: labelFor(outcome.dictionary, 'firm.aum_band', aumBand),
          advisorCount: asNumber(row.byKey.get('firm.advisor_count')),
          netAdvisorFlow90d: asNumber(
            row.byKey.get('firm.net_advisor_flow_90d'),
          ),
          savedRecordId: row.recordId,
          extra: extrasFor(row, input.columns),
        };
      }),
    };
  },
});
