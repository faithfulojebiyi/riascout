import Joi from 'joi';

import { baseEnvSchema, type BaseEnv } from '@system/env/env.schema.js';

export const workerEnvSchema = Joi.object({
  ...baseEnvSchema,
  PORT: Joi.number().port().default(3321),
  APP_DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .optional(),
  MARKET_DATA_DIR: Joi.string().allow('').optional(),
  RESEND_API_KEY: Joi.string().required(),
  MAIL_FROM: Joi.string().default('onboarding@resend.dev'),
});

export type WorkerEnv = BaseEnv & {
  PORT: number;
  APP_DATABASE_URL?: string;
  MARKET_DATA_DIR?: string;
  RESEND_API_KEY: string;
  MAIL_FROM: string;
};
