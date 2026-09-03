import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';

import { AppCqrsModule } from '@system/cqrs/cqrs.module.js';
import { DatabaseModule } from '@system/database/database.module.js';
import { AllExceptionsFilter } from '@system/interceptors/error.interceptor.js';

import { HealthModule } from './modules/health/health.module.js';
import { workerEnvSchema } from './worker.env.schema.js';
import { EventPublisherModule } from './modules/event-publisher/event-publisher.module.js';
import { ListsModule } from './modules/lists/lists.module.js';
import { MailModule } from './modules/mail/mail.module.js';

// no AlsModule here — ALS is HTTP-request-scoped and depcruise forbids the import
@Module({
  imports: [
    EventPublisherModule,
    ListsModule,
    MailModule,
    ConfigModule.forRoot({ isGlobal: true, validationSchema: workerEnvSchema }),
    AppCqrsModule,
    DatabaseModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class WorkerModule {}
