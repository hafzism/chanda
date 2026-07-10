import { HttpException } from '@nestjs/common';
import { StructuredLogger } from '@suppline/observability';
import type { Request, Response } from 'express';
import { firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { RequestLoggingInterceptor } from '../src/observability/request-logging.interceptor';

function harness(input?: { requestId?: string }) {
  const lines: string[] = [];
  const setHeader = vi.fn();
  const request = {
    header: () => input?.requestId,
    method: 'GET',
    params: {
      conversationId: '22222222-2222-4222-8222-222222222222',
      workspaceId: '11111111-1111-4111-8111-111111111111',
    },
    route: { path: '/v1/workspaces/:workspaceId/inbox/:conversationId' },
  } as unknown as Request<Record<string, string | undefined>>;
  const response = { setHeader, statusCode: 200 } as unknown as Response;
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  };
  const logger = new StructuredLogger({
    service: 'api',
    stdout: (line) => lines.push(line),
  });
  return {
    context,
    interceptor: new RequestLoggingInterceptor(logger),
    lines,
    setHeader,
  };
}

describe('RequestLoggingInterceptor', () => {
  it('preserves a safe request ID and logs route templates with correlation IDs', async () => {
    const { context, interceptor, lines, setHeader } = harness({
      requestId: 'request-1234',
    });

    await firstValueFrom(
      interceptor.intercept(context as never, { handle: () => of('ok') }),
    );

    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'request-1234');
    expect(JSON.parse(lines[0] ?? '')).toMatchObject({
      data: {
        conversationId: '22222222-2222-4222-8222-222222222222',
        event: 'http_request_completed',
        requestId: 'request-1234',
        route: '/v1/workspaces/:workspaceId/inbox/:conversationId',
        statusCode: 200,
        workspaceId: '11111111-1111-4111-8111-111111111111',
      },
    });
  });

  it('replaces unsafe IDs and records sanitized HTTP error status', async () => {
    const { context, interceptor, lines, setHeader } = harness({
      requestId: 'Bearer secret',
    });

    await expect(
      firstValueFrom(
        interceptor.intercept(context as never, {
          handle: () => throwError(() => new HttpException('no', 403)),
        }),
      ),
    ).rejects.toBeInstanceOf(HttpException);

    const generated = setHeader.mock.calls[0]?.[1] as string;
    expect(generated).toMatch(/^[0-9a-f-]{36}$/);
    expect(lines[0]).not.toContain('Bearer secret');
    expect(JSON.parse(lines[0] ?? '')).toMatchObject({
      data: { requestId: generated, statusCode: 403 },
    });
  });
});
