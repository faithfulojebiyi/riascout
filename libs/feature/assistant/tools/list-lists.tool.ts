import { z } from 'zod';

import { defineTool } from './define-tool.js';
import {
  entityFor,
  listSummarySchema,
  listUrl,
  sourceKindSchema,
} from './list-support.js';

export const listListsTool = defineTool({
  id: 'list_lists',
  scope: 'read',
  approval: false,
  description: [
    "The workspace's lists of advisers or firms, newest first, with member counts.",
    'Call it to find the listId when the user names an existing list, or to answer "what lists do we have".',
  ].join(' '),
  input: z.object({ sourceKind: sourceKindSchema }),
  output: z.object({
    entity: z.object({ id: z.string(), slug: z.string(), name: z.string() }),
    lists: z.array(listSummarySchema),
  }),
  execute: async ({ sourceKind }, ctx) => {
    const entity = await entityFor(sourceKind, ctx);
    const lists = await ctx.queries.getLists(ctx.identity, entity.id);

    return {
      entity: { id: entity.id, slug: entity.slug, name: entity.name },
      lists: lists.map(({ id, name, memberCount, createdAt }) => ({
        id,
        name,
        memberCount,
        createdAt,
        url: listUrl(entity.slug, id),
      })),
    };
  },
});
