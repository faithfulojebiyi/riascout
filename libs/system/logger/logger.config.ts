import type { Params } from 'nestjs-pino';

const isDev = process.env.NODE_ENV === 'development';

// no otel/sentry — observability is plain pino
export const loggerConfig = (serviceName: string): Params => ({
  pinoHttp: {
    name: serviceName,
    level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
    transport: isDev
      ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'HH:MM:ss.l' } }
      : undefined,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      censor: '[redacted]',
    },
    autoLogging: {
      ignore: (req) => (req.url ?? '').startsWith('/health'),
    },
    customProps: (req) => ({ requestId: req.headers['x-request-id'] }),
  },
});
