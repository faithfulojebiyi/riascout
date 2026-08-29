import Joi from 'joi';

// shared across both apps; each app extends it with its own keys
export const baseEnvSchema = {
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  LOG_LEVEL: Joi.string()
    .valid('trace', 'debug', 'info', 'warn', 'error', 'fatal')
    .optional(),
  API_PREFIX: Joi.string().allow('').default(''),
};

export type BaseEnv = {
  NODE_ENV: 'development' | 'test' | 'production';
  LOG_LEVEL?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  API_PREFIX: string;
};
