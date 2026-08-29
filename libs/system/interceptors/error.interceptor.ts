import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

type ErrorBody = {
  statusCode: number;
  message: string | string[];
  error: string;
  requestId?: string;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body: ErrorBody = {
      statusCode: status,
      ...this.describe(exception, status),
      requestId: request.headers['x-request-id'] as string | undefined,
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        { err: exception, url: request.url },
        'unhandled exception',
      );
    }

    reply.status(status).send(body);
  }

  private describe(
    exception: unknown,
    status: number,
  ): Pick<ErrorBody, 'message' | 'error'> {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return { message: response, error: exception.name };
      }

      const shaped = response as {
        message?: string | string[];
        error?: string;
      };

      return {
        message: shaped.message ?? exception.message,
        error: shaped.error ?? exception.name,
      };
    }

    // never leak internals on a 500
    return {
      message:
        status >= HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Internal server error'
          : 'Request failed',
      error: 'InternalServerError',
    };
  }
}
