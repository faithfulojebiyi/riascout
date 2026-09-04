import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Pool } from 'pg';

import {
  buildFieldDictionary,
  renderDictionarySections,
} from '@feature/assistant/filter/field-dictionary.js';
import type { ToolIdentity } from '@feature/assistant/tools/define-tool.js';
import { getMastra, type MastraRuntime } from '@providers/mastra/mastra.js';

import { AssistantQueriesAdapter } from './assistant-queries.adapter.js';

/** the dictionary only changes when attributes do; a short ttl is plenty for the spike */
const DICTIONARY_TTL_MS = 5 * 60_000;

/** only production terminates TLS; dev and test run against a local postgres */
const ssl =
  process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : undefined;

@Injectable()
export class MastraService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool | null = null;
  private runtime: MastraRuntime | null = null;
  private readonly dictionaries = new Map<
    string,
    { text: string; expiresAt: number }
  >();

  constructor(private readonly queries: AssistantQueriesAdapter) {}

  onModuleInit(): void {
    this.ensureRuntime();
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  /** main.ts mounts the routes before Nest's lifecycle hooks run, so init is lazy */
  get mastra(): MastraRuntime['mastra'] {
    return this.ensureRuntime().mastra;
  }

  private ensureRuntime(): MastraRuntime {
    if (this.runtime) {
      return this.runtime;
    }

    const connectionString = process.env.APP_DATABASE_URL;

    if (!connectionString) {
      throw new Error('APP_DATABASE_URL is required');
    }

    // small and separate from prisma's pool: agent traffic must not starve the grid
    this.pool = new Pool({ connectionString, max: 4, ssl });
    this.runtime = getMastra({ pool: this.pool, queries: this.queries });

    return this.runtime;
  }

  /** rendered once per workspace and reused, so the prompt prefix stays byte-stable */
  async dictionaryFor(identity: ToolIdentity): Promise<string> {
    const cached = this.dictionaries.get(identity.workspaceId);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.text;
    }

    const [advisor, firm] = await Promise.all([
      this.queries.getFacets(identity, 'advisor'),
      this.queries.getFacets(identity, 'firm'),
    ]);
    const text = renderDictionarySections({
      advisor: buildFieldDictionary(advisor),
      firm: buildFieldDictionary(firm),
    });

    this.dictionaries.set(identity.workspaceId, {
      text,
      expiresAt: Date.now() + DICTIONARY_TTL_MS,
    });

    return text;
  }
}
