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
  STORAGE_DRIVER: Joi.string().valid('tigris').default('tigris'),
  TIGRIS_STORAGE_ACCESS_KEY_ID: Joi.string().required(),
  TIGRIS_STORAGE_SECRET_ACCESS_KEY: Joi.string().required(),
  TIGRIS_STORAGE_ENDPOINT: Joi.string().uri().default('https://t3.storage.dev'),
  TIGRIS_STORAGE_BUCKET: Joi.string().required(),
  RESEND_API_KEY: Joi.string().required(),
  MAIL_FROM: Joi.string().default('onboarding@resend.dev'),
  APP_URL: Joi.string().uri().default('http://localhost:3020'),
});

export type ApiEnv = BaseEnv & {
  PORT: number;
  APP_DATABASE_URL?: string;
  APP_REDIS_URL?: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
  STORAGE_DRIVER: string;
  TIGRIS_STORAGE_ACCESS_KEY_ID: string;
  TIGRIS_STORAGE_SECRET_ACCESS_KEY: string;
  TIGRIS_STORAGE_ENDPOINT: string;
  TIGRIS_STORAGE_BUCKET: string;
  RESEND_API_KEY: string;
  MAIL_FROM: string;
  APP_URL: string;
};
