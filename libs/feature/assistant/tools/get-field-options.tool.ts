import { z } from 'zod';

import { defineTool } from './define-tool.js';

export const FIELD_OPTIONS_MAX = 20;

export const getFieldOptionsTool = defineTool({
  id: 'get_field_options',
  scope: 'read',
  approval: false,
  description: [
    'Resolve free text to the exact option value of a field before filtering on it: a firm name, a city, a designation, a custodian.',
    'Use it whenever the dictionary line says "free text" or the value you need is not in its preview. Returns matching { value, label } pairs; filter with the value.',
  ].join(' '),
  input: z.object({
    field: z.string().min(1).describe('Field key from the field dictionary'),
    query: z.string().trim().max(120).default(''),
    limit: z.number().int().min(1).max(FIELD_OPTIONS_MAX).default(10),
  }),
  output: z.object({
    field: z.string(),
    options: z.array(z.object({ value: z.string(), label: z.string() })),
  }),
  execute: async (input, { queries, identity }) => ({
    field: input.field,
    options: await queries.searchFacetOptions(identity, {
      allowKey: input.field,
      query: input.query,
      limit: input.limit,
    }),
  }),
});
