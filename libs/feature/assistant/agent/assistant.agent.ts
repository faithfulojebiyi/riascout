import { Agent } from '@mastra/core/agent';
import type { Memory } from '@mastra/memory';

import type { AssistantQueries } from '../tools/define-tool.js';
import { ASSISTANT_TOOLS } from '../tools/index.js';
import { REQUEST_CONTEXT_KEYS, toMastraTool } from './mastra-tool.adapter.js';
import { buildInstructions } from './system-prompt.js';

export const ASSISTANT_AGENT_ID = 'assistant';

export const ASSISTANT_MODEL = 'anthropic/claude-opus-5';

export const createAssistantAgent = (deps: {
  memory: Memory;
  queries: AssistantQueries;
}): Agent =>
  new Agent({
    id: ASSISTANT_AGENT_ID,
    name: 'RIAScout assistant',
    // the dictionary is per workspace; the boundary hook renders it once per request
    instructions: ({ requestContext }) => {
      const dictionaryText = requestContext.get(
        REQUEST_CONTEXT_KEYS.dictionaryText,
      );

      return buildInstructions(
        typeof dictionaryText === 'string' ? dictionaryText : '',
      );
    },
    model: ASSISTANT_MODEL,
    tools: Object.fromEntries(
      ASSISTANT_TOOLS.map((tool) => [
        tool.id,
        toMastraTool(tool, deps.queries),
      ]),
    ),
    memory: deps.memory,
    defaultOptions: {
      maxSteps: 8,
      providerOptions: {
        anthropic: {
          thinking: { type: 'adaptive', display: 'summarized' },
          effort: 'medium',
          // request-level cache_control: the stable prefix is instructions + tools
          cacheControl: { type: 'ephemeral' },
        },
      },
    },
  });
