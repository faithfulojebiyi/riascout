import { z } from 'zod';

import type { EntitySummary, SourceKind, ToolContext } from './define-tool.js';

export const sourceKindSchema = z
  .enum(['advisor', 'firm'])
  .describe('which kind of list: advisers or firms');

export const listSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  memberCount: z.number().int(),
  createdAt: z.string(),
  /** the dashboard page for the list */
  url: z.string(),
});

/** the CRM entity that mirrors a market projection; every list belongs to one */
export const entityFor = async (
  sourceKind: SourceKind,
  { queries, identity }: ToolContext,
): Promise<EntitySummary> => {
  const entity = (await queries.getEntities(identity)).find(
    (candidate) => candidate.sourceKind === sourceKind,
  );

  if (!entity) {
    throw new Error(`this workspace has no ${sourceKind} entity to hold lists`);
  }

  return entity;
};

export const listUrl = (entitySlug: string, listId: string): string =>
  `/${entitySlug}?list=${listId}`;
