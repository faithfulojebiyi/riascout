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
/**
 * Mastra's types say toModelOutput receives the output, but at runtime it is
 * called with { toolCallId, input, output }. Accept both.
 */
const unwrapToolOutput = (arg: unknown): unknown =>
  typeof arg === 'object' && arg !== null && 'output' in arg
    ? (arg as { output: unknown }).output
    : arg;

const toJsonValue = (value: unknown): Record<string, unknown> =>
  JSON.parse(JSON.stringify(value ?? null)) as Record<string, unknown>;

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
    toModelOutput: definition.toModelOutput
      ? (arg: unknown) => ({
          // the AI SDK wants a tagged ToolResultOutput; a bare object reaches the model as nothing
          type: 'json' as const,
          value: toJsonValue(definition.toModelOutput?.(unwrapToolOutput(arg))),
        })
      : undefined,
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
