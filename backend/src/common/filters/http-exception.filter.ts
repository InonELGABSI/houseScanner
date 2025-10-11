import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { REQUEST_ID_HEADER } from '../constants';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus?.() ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception.getResponse();
    const message = this.extractMessage(payload, exception.message);
    const serverErrorThreshold = Number(HttpStatus.INTERNAL_SERVER_ERROR);

    if (Number(status) >= serverErrorThreshold) {
      this.logger.error(message, exception.stack);
    } else {
      this.logger.warn(message);
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      requestId: request.headers[REQUEST_ID_HEADER],
    });
  }

  private extractMessage(response: unknown, fallback: string): string {
    if (typeof response === 'string') {
      return response;
    }
    if (typeof response === 'object' && response) {
      const { message } = response as { message?: unknown };
      if (Array.isArray(message)) {
        return message.join(', ');
      }
      if (typeof message === 'string') {
        return message;
      }
    }
    return fallback;
  }
}
