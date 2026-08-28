import './load-env.js';

import compress from '@fastify/compress';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { AppLogger } from '@system/logger/logger.service.js';

import { ApiModule } from './api.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(ApiModule, new FastifyAdapter(), {
    bufferLogs: true,
    logger: new AppLogger('api'),
  });

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

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('RIAScout API').setVersion('0.0.1').build(),
  );

  // cleanupOpenApiDoc makes the zod-generated 3.1 doc consumable by orval
  SwaggerModule.setup('docs', app, cleanupOpenApiDoc(document));

  const port = Number(process.env.PORT ?? 3320);
  await app.listen({ port, host: '0.0.0.0' });
}

await bootstrap();
