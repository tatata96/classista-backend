import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsHandler');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      response
        .status(exception.getStatus())
        .json(this.buildBody(exception, request.url));
      return;
    }

    // Anything that isn't a deliberate HttpException is a bug or an unexpected
    // failure (e.g. a database error). Log the full detail server-side, but
    // never leak internals like stack traces or driver errors to the client.
    this.logger.error(
      exception instanceof Error
        ? (exception.stack ?? exception.message)
        : exception,
    );

    const body: ErrorResponseBody = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Something went wrong. Please try again later.',
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }

  private buildBody(exception: HttpException, path: string): ErrorResponseBody {
    const status = exception.getStatus();
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return {
        statusCode: status,
        error: exception.name,
        message: payload,
        timestamp: new Date().toISOString(),
        path,
      };
    }

    const body = payload as Record<string, unknown>;

    return {
      statusCode: status,
      error: (body.error as string) ?? exception.name,
      message: (body.message as string | string[]) ?? exception.message,
      timestamp: new Date().toISOString(),
      path,
    };
  }
}
