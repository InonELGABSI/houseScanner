import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { REQUEST_ID_HEADER } from '../constants';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const { method, url } = request;
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const elapsed = Date.now() - started;
          const requestIdHeader = request.headers[REQUEST_ID_HEADER];
          const requestId = Array.isArray(requestIdHeader)
            ? requestIdHeader.join(',')
            : (requestIdHeader ?? 'n/a');
          this.logger.log(
            `${method} ${url} ${response.statusCode} +${elapsed}ms requestId=${requestId}`,
          );
        },
        error: (error: unknown) => {
          const elapsed = Date.now() - started;
          const requestIdHeader = request.headers[REQUEST_ID_HEADER];
          const requestId = Array.isArray(requestIdHeader)
            ? requestIdHeader.join(',')
            : (requestIdHeader ?? 'n/a');
          this.logger.error(
            `${method} ${url} failed after ${elapsed}ms requestId=${requestId}`,
            (error as Error)?.stack,
          );
        },
      }),
    );
  }
}
