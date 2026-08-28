import Joi from 'joi';

import { baseEnvSchema, type BaseEnv } from '@system/env/env.schema.js';

export const apiEnvSchema = Joi.object({
  ...baseEnvSchema,
  PORT: Joi.number().port().default(3320),
  APP_DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).optional(),
  APP_REDIS_URL: Joi.string().optional(),
});

export type ApiEnv = BaseEnv & {
  PORT: number;
  APP_DATABASE_URL?: string;
  APP_REDIS_URL?: string;
};
