import { Mastra } from '@mastra/core/mastra';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import type { Pool } from 'pg';

import { createAssistantAgent } from '@feature/assistant/agent/assistant.agent.js';
import type { AssistantQueries } from '@feature/assistant/tools/define-tool.js';

/** mastra's tables live here; prisma manages only app and market */
export const MASTRA_SCHEMA = 'agent';

export type MastraRuntime = {
  mastra: Mastra;
  memory: Memory;
  storage: PostgresStore;
};

let runtime: MastraRuntime | null = null;

/**
 * Lazy singleton: env is not loaded at import time, and the store connects on
 * construction. The pool is owned by the caller, so closing the runtime never
 * closes a pool it did not open.
 */
export const getMastra = (deps: {
  pool: Pool;
  queries: AssistantQueries;
}): MastraRuntime => {
  if (runtime) {
    return runtime;
  }

  const storage = new PostgresStore({
    id: 'riascout-agent',
    pool: deps.pool,
    schemaName: MASTRA_SCHEMA,
  });

  const memory = new Memory({
    storage,
    options: {
      lastMessages: 30,
      workingMemory: { enabled: false },
      generateTitle: false,
    },
  });

  const assistant = createAssistantAgent({ memory, queries: deps.queries });

  runtime = {
    mastra: new Mastra({ agents: { assistant }, storage }),
    memory,
    storage,
  };

  return runtime;
};
