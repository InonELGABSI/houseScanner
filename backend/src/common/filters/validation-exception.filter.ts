import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { REQUEST_ID_HEADER } from '../constants';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationExceptionFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus();
    const payload = exception.getResponse() as
      | string
      | { message?: string | string[]; error?: string };

    const messages = Array.isArray(payload['message'])
      ? payload['message']
      : [
          typeof payload === 'string'
            ? payload
            : (payload['message'] ?? exception.message),
        ];

    this.logger.debug(`Validation failed: ${messages.join(', ')}`);

    response.status(status).json({
      statusCode: status,
      message: messages,
      error: typeof payload === 'object' ? payload['error'] : undefined,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      requestId: request.headers[REQUEST_ID_HEADER],
    });
  }
}
