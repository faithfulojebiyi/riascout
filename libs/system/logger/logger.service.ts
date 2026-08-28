import { Injectable, type LoggerService, Scope } from '@nestjs/common';
import { pino, type Logger } from 'pino';

/**
 * Thin pino adapter. Replaces nestjs-pino, which is CJS and require()s
 * @nestjs/common — unresolvable now that Nest 12 ships async ESM.
 */
@Injectable({ scope: Scope.DEFAULT })
export class AppLogger implements LoggerService {
  private readonly logger: Logger;

  constructor(serviceName: string) {
    const isDev = process.env.NODE_ENV === 'development';

    this.logger = pino({
      name: serviceName,
      level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'password', 'token'],
        censor: '[redacted]',
      },
      transport: isDev
        ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'HH:MM:ss.l' } }
        : undefined,
    });
  }

  log(message: unknown, context?: unknown): void {
    this.logger.info(this.shape(message, context));
  }

  error(message: unknown, stack?: unknown, context?: unknown): void {
    this.logger.error({ ...this.shape(message, context), stack });
  }

  warn(message: unknown, context?: unknown): void {
    this.logger.warn(this.shape(message, context));
  }

  debug(message: unknown, context?: unknown): void {
    this.logger.debug(this.shape(message, context));
  }

  verbose(message: unknown, context?: unknown): void {
    this.logger.trace(this.shape(message, context));
  }

  fatal(message: unknown, context?: unknown): void {
    this.logger.fatal(this.shape(message, context));
  }

  /** exposed for request logging and structured child loggers */
  child(bindings: Record<string, unknown>): Logger {
    return this.logger.child(bindings);
  }

  private shape(message: unknown, context?: unknown): Record<string, unknown> {
    const ctx = typeof context === 'string' ? context : undefined;

    if (typeof message === 'string') {
      return { msg: message, context: ctx };
    }

    return { ...(message as Record<string, unknown>), context: ctx };
  }
}
