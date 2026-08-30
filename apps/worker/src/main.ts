import './load-env.js';

import { NestFactory } from '@nestjs/core';
import { serve } from 'inngest/fastify';

import { AppPrismaService } from '@system/database/database.service.js';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';

import { AppLogger } from '@system/logger/logger.service.js';

import { inngest } from './modules/event-publisher/event-publisher.service.js';
import { getInngestRegistry } from './modules/event-publisher/inngest.registry.js';
import { WorkerModule } from './worker.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    WorkerModule,
    new FastifyAdapter(),
    {
      bufferLogs: true,
      logger: new AppLogger('worker'),
    },
  );

  const prefix = process.env.API_PREFIX ?? '';

  if (prefix) {
    app.setGlobalPrefix(prefix);
  }

  const appPrismaService = app.get(AppPrismaService);

  app
    .getHttpAdapter()
    .getInstance()
    .route({
      method: ['GET', 'POST', 'PUT'],
      url: `${prefix}/api/inngest`,
      handler: serve({
        client: inngest,
        functions: getInngestRegistry({ appPrismaService }),
      }),
    });

  const port = Number(process.env.PORT ?? 3321);
  await app.listen({ port, host: '0.0.0.0' });
}

await bootstrap();
