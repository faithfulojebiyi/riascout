import Joi from 'joi';

import { baseEnvSchema, type BaseEnv } from '@system/env/env.schema.js';

export const workerEnvSchema = Joi.object({
  ...baseEnvSchema,
  PORT: Joi.number().port().default(3321),
  APP_DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .optional(),
  ASSET_DATA_DIR: Joi.string().allow('').optional(),
});

export type WorkerEnv = BaseEnv & {
  PORT: number;
  APP_DATABASE_URL?: string;
  ASSET_DATA_DIR?: string;
};
