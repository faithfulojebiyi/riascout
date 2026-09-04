import { z } from 'zod';

import { defineTool } from './define-tool.js';
import { entityFor, listUrl, sourceKindSchema } from './list-support.js';

export const createListTool = defineTool({
  id: 'create_list',
  scope: 'write',
  approval: true,
  description: [
    'Create an empty list of advisers or firms. The recruiter approves it first.',
    'To create a list and fill it in one step, use add_to_list with newListName instead.',
  ].join(' '),
  input: z.object({
    sourceKind: sourceKindSchema,
    name: z.string().trim().min(1).max(120),
  }),
  output: z.object({
    list: z.object({
      id: z.string(),
      name: z.string(),
      memberCount: z.number().int(),
    }),
    entitySlug: z.string(),
    url: z.string(),
  }),
  execute: async ({ sourceKind, name }, ctx) => {
    const entity = await entityFor(sourceKind, ctx);
    const list = await ctx.queries.createList(ctx.identity, {
      entityId: entity.id,
      name,
    });

    return {
      list: { ...list, memberCount: 0 },
      entitySlug: entity.slug,
      url: listUrl(entity.slug, list.id),
    };
  },
});
