import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';

import type {
  AssistantQueries,
  ToolDefinition,
  ToolIdentity,
} from '../tools/define-tool.js';

export const REQUEST_CONTEXT_KEYS = {
  userId: 'userId',
  workspaceId: 'workspaceId',
  dictionaryText: 'dictionaryText',
} as const;

/** identity is set by the http boundary; a tool run without it must not touch data */
export const readIdentity = (
  requestContext: RequestContext | undefined,
): ToolIdentity | null => {
  const userId = requestContext?.get(REQUEST_CONTEXT_KEYS.userId);
  const workspaceId = requestContext?.get(REQUEST_CONTEXT_KEYS.workspaceId);

  return typeof userId === 'string' && typeof workspaceId === 'string'
    ? { userId, workspaceId }
    : null;
};

/**
 * Bridges a framework-neutral definition into a Mastra tool. Schemas are
 * handed over as-is so Mastra validates input before execute runs; the
 * definition's own generics are erased here because Mastra's inference type
 * and zod's output type are not provably the same to the compiler.
 */
export const toMastraTool = (
  definition: ToolDefinition,
  queries: AssistantQueries,
) =>
  createTool({
    id: definition.id,
    description: definition.description,
    inputSchema: definition.input,
    outputSchema: definition.output,
    requireApproval: definition.approval,
    toModelOutput: definition.toModelOutput,
    execute: async (input, context) => {
      const identity = readIdentity(context?.requestContext);

      if (!identity) {
        throw new Error(
          'assistant tool called without an authenticated identity',
        );
      }

      return definition.execute(input, { queries, identity });
    },
  });
