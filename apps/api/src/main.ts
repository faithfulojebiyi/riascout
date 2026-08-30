import './load-env.js';

import compress from '@fastify/compress';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { NestFactory } from '@nestjs/core';
import { serve } from 'inngest/fastify';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { auth } from '@system/auth/auth.js';
import { AppLogger } from '@system/logger/logger.service.js';

import { inngest } from './modules/event-publisher/event-publisher.service.js';
import { getInngestRegistry } from './modules/event-publisher/inngest.registry.js';
import { ApiModule } from './api.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    ApiModule,
    new FastifyAdapter(),
    {
      bufferLogs: true,
      logger: new AppLogger('api'),
    },
  );

  await app.register(helmet);
  await app.register(cookie);
  await app.register(compress);

  const prefix = process.env.API_PREFIX ?? '';

  if (prefix) {
    app.setGlobalPrefix(prefix);
  }

  // credentialed cors with an explicit allowlist — never a wildcard
  const origins = (process.env.TRUSTED_ORIGINS ?? 'http://localhost:3020')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({ origin: origins, credentials: true });

  /**
   * Raw fastify route: better-auth owns its own request/response handling and
   * must bypass the Nest pipe/guard/interceptor stack entirely.
   */
  const fastify = app.getHttpAdapter().getInstance();

  fastify.route({
    method: ['GET', 'POST'],
    url: `${prefix ? `/${prefix}` : ''}/api/auth/*`,
    handler: async (request, reply) => {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const headers = new Headers();

      for (const [key, value] of Object.entries(request.headers)) {
        if (value !== undefined) {
          headers.append(
            key,
            Array.isArray(value) ? value.join(',') : String(value),
          );
        }
      }

      // content-length is stale: fastify already parsed and we re-serialize
      headers.delete('content-length');

      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers,
          body: request.body ? JSON.stringify(request.body) : undefined,
        }),
      );

      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      reply.send(await response.text());
    },
  });

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('RIAScout API').setVersion('0.0.1').build(),
  );

  // cleanupOpenApiDoc makes the zod-generated 3.1 doc consumable by orval
  SwaggerModule.setup('docs', app, cleanupOpenApiDoc(document));

  /**
   * Both apps serve /api/inngest with their own client id. The dev server
   * discovers each one, so a function registered on the worker is invoked
   * there rather than on the api.
   */
  app
    .getHttpAdapter()
    .getInstance()
    .route({
      method: ['GET', 'POST', 'PUT'],
      url: `${prefix}/api/inngest`,
      handler: serve({ client: inngest, functions: getInngestRegistry() }),
    });

  const port = Number(process.env.PORT ?? 3320);
  await app.listen({ port, host: '0.0.0.0' });
}

await bootstrap();
