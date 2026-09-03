import { z } from 'zod';

import { defineTool } from './define-tool.js';

export const LOOKUP_FIRM_MAX = 10;

export const lookupFirmTool = defineTool({
  id: 'lookup_firm',
  scope: 'read',
  approval: false,
  description: [
    'Find a firm CRD by name. Names are observations that change between filings, so always resolve a name to a CRD before asking about a firm.',
    'Returns up to 10 candidates ranked by name match; when more than one is plausible, ask the user which they mean rather than guessing.',
  ].join(' '),
  input: z.object({
    name: z.string().trim().min(2).max(120).describe('Firm name or fragment'),
    state: z
      .string()
      .trim()
      .length(2)
      .toUpperCase()
      .nullable()
      .default(null)
      .describe('Two-letter state to narrow the match'),
  }),
  output: z.object({
    candidates: z.array(
      z.object({
        firmCrd: z.string(),
        firmName: z.string().nullable(),
        city: z.string().nullable(),
        state: z.string().nullable(),
        /** decimal string; null means the filing did not report it */
        regulatoryAum: z.string().nullable(),
        advisorCount: z.number().int().nullable(),
      }),
    ),
  }),
  execute: async (input, { queries, identity }) => ({
    candidates: await queries.lookupFirm(identity, {
      query: input.name,
      state: input.state,
      limit: LOOKUP_FIRM_MAX,
    }),
  }),
});
