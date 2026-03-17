import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Global exception filter. Maps DomainError subclasses and HttpExceptions to consistent JSON.
 *
 * Works with or without @tkhtech/domain-errors. If DomainError is available, it reads
 * statusCode, code, and details from the error instance.
 *
 * Response shape:
 * {
 *   success: false,
 *   statusCode: number,
 *   error: { code: string, message: string, details?: unknown },
 *   path: string,
 *   timestamp: string
 * }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';
    let details: unknown;

    // DomainError duck-typing — works without direct import of @tkhtech/domain-errors
    if (isDomainError(exception)) {
      status = exception.statusCode;
      message = exception.message;
      code = exception.code;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp['message'] as string) || message;
        code = (resp['error'] as string) || code;
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      if (process.env['NODE_ENV'] !== 'production') {
        message = exception.message;
      }
    }

    this.logger.error(`${request.method} ${request.path} → ${status}: ${message}`);

    const errorBody: Record<string, unknown> = { code, message };
    if (details !== undefined) errorBody['details'] = details;

    response.status(status).json({
      success: false,
      statusCode: status,
      error: errorBody,
      path: request.path,
      timestamp: new Date().toISOString(),
    });
  }
}

interface DomainErrorShape {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

function isDomainError(err: unknown): err is DomainErrorShape {
  if (!(err instanceof Error)) return false;
  const e = err as unknown as Record<string, unknown>;
  return typeof e['statusCode'] === 'number' && typeof e['code'] === 'string';
}
