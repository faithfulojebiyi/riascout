import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';

import { AlsModule } from '@system/als/als.module.js';
import { AuthModule } from '@system/auth/auth.module.js';
import { AppCqrsModule } from '@system/cqrs/cqrs.module.js';
import { DatabaseModule } from '@system/database/database.module.js';
import { AllExceptionsFilter } from '@system/interceptors/error.interceptor.js';

import { apiEnvSchema } from './api.env.schema.js';
import { EntitiesModule } from './modules/entities/entities.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: apiEnvSchema }),
    AlsModule,
    AuthModule,
    AppCqrsModule,
    DatabaseModule,
    HealthModule,
    EntitiesModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class ApiModule {}
