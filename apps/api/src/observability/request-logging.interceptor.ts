import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import {
  type CallHandler,
  type ExecutionContext,
  HttpException,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { StructuredLogger } from '@suppline/observability';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { catchError, finalize, throwError } from 'rxjs';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteParams = Record<string, string | undefined>;

function requestId(request: Request<RouteParams>): string {
  const supplied = request.header('x-request-id');
  return supplied && SAFE_REQUEST_ID.test(supplied) ? supplied : randomUUID();
}

function routeTemplate(request: Request<RouteParams>): string {
  const route = request.route as { path?: unknown } | undefined;
  return typeof route?.path === 'string' ? route.path : '[unmatched]';
}

function correlationUuid(value: string | undefined): string | undefined {
  return value && UUID.test(value) ? value : undefined;
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: StructuredLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request<RouteParams>>();
    const response = http.getResponse<Response>();
    const correlationId = requestId(request);
    const started = performance.now();
    let errorStatus: number | undefined;
    response.setHeader('x-request-id', correlationId);

    return next.handle().pipe(
      catchError((error: unknown) => {
        errorStatus = error instanceof HttpException ? error.getStatus() : 500;
        return throwError(() => error);
      }),
      finalize(() => {
        this.logger.log({
          conversationId: correlationUuid(request.params.conversationId),
          durationMs: Math.round((performance.now() - started) * 10) / 10,
          event: 'http_request_completed',
          method: request.method,
          requestId: correlationId,
          route: routeTemplate(request),
          statusCode: errorStatus ?? response.statusCode,
          ticketId: correlationUuid(request.params.ticketId),
          workspaceId: correlationUuid(request.params.workspaceId),
        });
      }),
    );
  }
}
