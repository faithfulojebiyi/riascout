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
  STORAGE_LOCAL_DIR: Joi.string().optional(),
  STORAGE_PUBLIC_URL: Joi.string().uri().optional(),
});

export type ApiEnv = BaseEnv & {
  PORT: number;
  APP_DATABASE_URL?: string;
  APP_REDIS_URL?: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
  STORAGE_LOCAL_DIR?: string;
  STORAGE_PUBLIC_URL?: string;
};
