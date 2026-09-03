import { z } from 'zod';

import { defineTool } from './define-tool.js';

const facetRowSchema = z.object({
  code: z.string(),
  label: z.string().nullable(),
  /** null is unreported; fewerThanFive means the filing gave a range, not a count */
  clientCount: z.number().nullable(),
  fewerThanFive: z.boolean().nullable(),
  regulatoryAum: z.string().nullable(),
});

export const getFirmProfileTool = defineTool({
  id: 'get_firm_profile',
  scope: 'read',
  approval: false,
  description: [
    'Current Form ADV profile for a firm by CRD: client types, services, fee methods, and the reported client count.',
    'Use lookup_firm first when you only have a name.',
    'Null means not reported. reportedClients.quality tells you whether min/max is an exact number, a bounded range, or unavailable; never present a range as a total.',
  ].join(' '),
  input: z.object({
    firmCrd: z
      .string()
      .regex(/^\d+$/)
      .describe('Firm CRD as digits, e.g. "107024"'),
  }),
  output: z.object({
    firmCrd: z.string(),
    clientTypes: z.array(facetRowSchema),
    services: z.array(facetRowSchema),
    feeMethods: z.array(facetRowSchema),
    reportedClients: z.object({
      min: z.number().nullable(),
      max: z.number().nullable(),
      quality: z.enum(['reported_number', 'bounded_range', 'unavailable']),
    }),
    /** null when the CRD is known only as an adviser's employer and never filed */
    filingId: z.string().nullable(),
  }),
  execute: async (input, { queries, identity }) => {
    const profile = await queries.getFirmProfile(identity, input.firmCrd);

    return { firmCrd: input.firmCrd, ...profile };
  },
});
