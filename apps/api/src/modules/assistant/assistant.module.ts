import { Module } from '@nestjs/common';

import { AssistantQueriesAdapter } from './assistant-queries.adapter.js';
import { MastraService } from './mastra.service.js';

/**
 * No controller: the assistant's http surface is Mastra's own routes, mounted
 * on the fastify instance in main.ts. This module only wires the runtime.
 */
@Module({
  providers: [AssistantQueriesAdapter, MastraService],
  exports: [MastraService],
})
export class AssistantModule {}
