import { z } from 'zod';

import { agentFilterSchema } from '../filter/agent-filter.schema.js';
import { resolveAgentFilter } from '../filter/resolve-agent-filter.js';
import { defineTool } from './define-tool.js';
import { entityFor, listUrl, sourceKindSchema } from './list-support.js';
import { filterErrorSchema } from './prospect-search.js';

/** the API adds up to this many synchronously; a filter is always queued */
export const PICKED_CRDS_MAX = 1000;

const inputSchema = z
  .object({
    sourceKind: sourceKindSchema,
    listId: z
      .string()
      .nullable()
      .default(null)
      .describe('an existing list, from list_lists'),
    listName: z
      .string()
      .nullable()
      .default(null)
      .describe("the existing list's name, shown on the approval card"),
    newListName: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .nullable()
      .default(null)
      .describe('create this list and add to it'),
    sourceCrds: z
      .array(z.string().regex(/^\d+$/))
      .min(1)
      .max(PICKED_CRDS_MAX)
      .nullable()
      .default(null)
      .describe('specific advisers or firms by CRD'),
    filter: agentFilterSchema
      .nullable()
      .default(null)
      .describe(
        'everything a search matches; pass the filter you searched with',
      ),
    expectedTotal: z
      .number()
      .int()
      .nullable()
      .default(null)
      .describe('the total the search reported, shown to the recruiter'),
  })
  .refine((v) => (v.listId === null) !== (v.newListName === null), {
    message: 'pass exactly one of listId or newListName',
  })
  .refine((v) => (v.sourceCrds === null) !== (v.filter === null), {
    message: 'pass exactly one of sourceCrds or filter',
  });

const outputSchema = z.object({
  list: z
    .object({ id: z.string(), name: z.string(), isNew: z.boolean() })
    .nullable(),
  entitySlug: z.string().nullable(),
  url: z.string().nullable(),
  /** members requested; for a filter save this is the search total */
  requested: z.number().int(),
  /** memberships added so far; 0 while a queued add is still running */
  added: z.number().int(),
  recordsCreated: z.number().int(),
  /** true when the add runs in the background and the count settles later */
  queued: z.boolean(),
  filterErrors: z.array(filterErrorSchema).optional(),
});

export const addToListTool = defineTool({
  id: 'add_to_list',
  scope: 'write',
  approval: true,
  description: [
    'Add advisers or firms to a list, creating the list when newListName is given. The recruiter approves it first; call it once.',
    'Pass sourceCrds for specific people, or the filter from the search you just ran (with its total as expectedTotal) to save everything it matched.',
    'A filter save is queued and its member count settles shortly after; say so.',
  ].join(' '),
  input: inputSchema,
  output: outputSchema,
  execute: async (input, ctx) => {
    const failed = (
      filterErrors: NonNullable<z.output<typeof outputSchema>['filterErrors']>,
    ) => ({
      list: null,
      entitySlug: null,
      url: null,
      requested: 0,
      added: 0,
      recordsCreated: 0,
      queued: false,
      filterErrors,
    });

    // compile before any write so a bad filter never leaves an empty list behind
    const resolved = input.filter
      ? await resolveAgentFilter(input.filter, input.sourceKind, ctx)
      : null;

    if (resolved && !resolved.ok) return failed(resolved.filterErrors);

    const entity = await entityFor(input.sourceKind, ctx);
    let list: { id: string; name: string; isNew: boolean };

    if (input.newListName !== null) {
      const created = await ctx.queries.createList(ctx.identity, {
        entityId: entity.id,
        name: input.newListName,
      });

      list = { ...created, isNew: true };
    } else {
      const existing = (
        await ctx.queries.getLists(ctx.identity, entity.id)
      ).find((candidate) => candidate.id === input.listId);

      if (!existing) {
        throw new Error(`no ${input.sourceKind} list with id ${input.listId}`);
      }

      list = { id: existing.id, name: existing.name, isNew: false };
    }

    let result;

    try {
      result = await ctx.queries.addToList(
        ctx.identity,
        input.sourceCrds
          ? { listId: list.id, sourceCrds: input.sourceCrds }
          : // an empty filter means "everything"; the API needs an explicit tree
            {
              listId: list.id,
              filter: resolved?.tree ?? { kind: 'and', children: [] },
            },
      );
    } catch (error) {
      // the list may already exist by now; the model must not claim nothing happened
      const reason = error instanceof Error ? error.message : String(error);

      throw new Error(
        `${list.isNew ? `Created the list "${list.name}" (${list.id}) but the` : 'The'} add did not run: ${reason}. ` +
          (input.filter
            ? 'Filter saves run through the background job service; if it is unreachable, say so and offer to retry.'
            : 'Offer to retry.'),
      );
    }

    return {
      list,
      entitySlug: entity.slug,
      url: listUrl(entity.slug, list.id),
      requested: result.completed
        ? result.requested
        : (input.expectedTotal ?? result.requested),
      added: result.membersAdded,
      recordsCreated: result.recordsCreated,
      queued: !result.completed,
    };
  },
});
