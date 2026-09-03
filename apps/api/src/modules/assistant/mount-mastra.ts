import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import { MastraServer } from '@mastra/fastify';
import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';

import { REQUEST_CONTEXT_KEYS } from '@feature/assistant/agent/mastra-tool.adapter.js';
import { resolveSessionIdentity } from '@system/auth/session-identity.js';

import type { MastraService } from './mastra.service.js';

export const MASTRA_ROUTE_PREFIX = '/agent';

/** users belong to several workspaces; threads must not follow them across */
export const resourceIdFor = (userId: string, workspaceId: string): string =>
  `ws_${workspaceId}:u_${userId}`;

/**
 * Mastra's routes have no auth configured, so this hook is the whole boundary:
 * it runs after Mastra's context middleware and before every Mastra route,
 * rejects anonymous callers, and pins identity onto the request context that
 * tools and memory read. MASTRA_RESOURCE_ID_KEY is what makes Mastra refuse
 * another user's thread.
 */
const identityHook =
  (service: MastraService): preHandlerAsyncHookHandler =>
  async (request, reply) => {
    const identity = await resolveSessionIdentity(request.headers);

    if (!identity) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    if (!identity.workspaceId) {
      return reply
        .status(403)
        .send({ error: 'No active workspace for this session' });
    }

    const { userId, workspaceId } = identity;
    const context = request.requestContext;

    context.set(MASTRA_RESOURCE_ID_KEY, resourceIdFor(userId, workspaceId));
    context.set(REQUEST_CONTEXT_KEYS.userId, userId);
    context.set(REQUEST_CONTEXT_KEYS.workspaceId, workspaceId);
    context.set(
      REQUEST_CONTEXT_KEYS.dictionaryText,
      await service.dictionaryFor({ userId, workspaceId }),
    );
  };

/**
 * Encapsulated plugin: Mastra swaps the JSON body parser and adds hooks on the
 * instance it is given, so it gets a child instance and Nest's routes keep theirs.
 */
export const mountMastra = async (
  fastify: FastifyInstance,
  service: MastraService,
  prefix: string,
): Promise<void> => {
  await fastify.register(async (child) => {
    const server = new MastraServer({
      app: child,
      mastra: service.mastra,
      prefix: `${prefix}${MASTRA_ROUTE_PREFIX}`,
    });

    server.registerContextMiddleware();
    child.addHook('preHandler', identityHook(service));
    await server.registerRoutes();
  });
};
