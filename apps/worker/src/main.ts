import './load-env.js';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';

import { WorkerModule } from './worker.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(WorkerModule, new FastifyAdapter(), {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  const prefix = process.env.API_PREFIX ?? '';

  if (prefix) {
    app.setGlobalPrefix(prefix);
  }

  const port = Number(process.env.PORT ?? 3321);
  await app.listen({ port, host: '0.0.0.0' });
}

await bootstrap();
