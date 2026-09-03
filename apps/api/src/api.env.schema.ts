import Joi from 'joi';

import { baseEnvSchema, type BaseEnv } from '@system/env/env.schema.js';

export const apiEnvSchema = Joi.object({
  ...baseEnvSchema,
  PORT: Joi.number().port().default(3320),
  APP_DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .optional(),
  APP_REDIS_URL: Joi.string().optional(),
  BETTER_AUTH_SECRET: Joi.string().min(32).required(),
  BETTER_AUTH_URL: Joi.string().uri().required(),
  BETTER_AUTH_TRUSTED_ORIGINS: Joi.string().optional(),
  STORAGE_DRIVER: Joi.string().valid('tigris', 'local').default('tigris'),
  // only the driver that talks to the object store needs credentials
  TIGRIS_STORAGE_ACCESS_KEY_ID: Joi.string().when('STORAGE_DRIVER', {
    is: 'tigris',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  TIGRIS_STORAGE_SECRET_ACCESS_KEY: Joi.string().when('STORAGE_DRIVER', {
    is: 'tigris',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  TIGRIS_STORAGE_ENDPOINT: Joi.string().uri().default('https://t3.storage.dev'),
  TIGRIS_STORAGE_BUCKET: Joi.string().when('STORAGE_DRIVER', {
    is: 'tigris',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  // local driver only; both fall back to sensible defaults
  STORAGE_LOCAL_DIR: Joi.string().allow('').optional(),
  STORAGE_PUBLIC_URL: Joi.string().uri().optional(),
  MAIL_TRANSPORT: Joi.string().valid('resend', 'log').default('resend'),
  // only the transport that actually calls the api needs a key
  RESEND_API_KEY: Joi.string().when('MAIL_TRANSPORT', {
    is: 'resend',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  MAIL_FROM: Joi.string().default('onboarding@resend.dev'),
  APP_URL: Joi.string().uri().default('http://localhost:3020'),
  // the assistant's model provider; mastra reads it by this exact name
  ANTHROPIC_API_KEY: Joi.string().required(),
  MASTRA_TELEMETRY_DISABLED: Joi.string().default('1'),
});

export type ApiEnv = BaseEnv & {
  PORT: number;
  APP_DATABASE_URL?: string;
  APP_REDIS_URL?: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
  STORAGE_DRIVER: 'tigris' | 'local';
  TIGRIS_STORAGE_ACCESS_KEY_ID?: string;
  TIGRIS_STORAGE_SECRET_ACCESS_KEY?: string;
  TIGRIS_STORAGE_ENDPOINT: string;
  TIGRIS_STORAGE_BUCKET?: string;
  STORAGE_LOCAL_DIR?: string;
  STORAGE_PUBLIC_URL?: string;
  MAIL_TRANSPORT: 'resend' | 'log';
  RESEND_API_KEY?: string;
  MAIL_FROM: string;
  APP_URL: string;
  ANTHROPIC_API_KEY: string;
  MASTRA_TELEMETRY_DISABLED: string;
};
