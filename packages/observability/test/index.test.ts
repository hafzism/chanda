import { describe, expect, it } from 'vitest';

import { StructuredLogger } from '../src';

describe('StructuredLogger', () => {
  it('writes stable JSON with service and context', () => {
    const output: string[] = [];
    const logger = new StructuredLogger({
      clock: () => new Date('2026-07-14T00:00:00.000Z'),
      service: 'api',
      stdout: (line) => output.push(line),
    });

    logger.log('ready', 'Bootstrap');

    expect(JSON.parse(output[0] ?? '')).toEqual({
      context: 'Bootstrap',
      level: 'info',
      message: 'ready',
      service: 'api',
      timestamp: '2026-07-14T00:00:00.000Z',
    });
  });

  it('redacts nested credentials and handles circular values', () => {
    const output: string[] = [];
    const event: Record<string, unknown> = {
      authorization: 'Bearer exposed',
      nested: { password: 'exposed', workspaceId: 'workspace-1' },
    };
    event.self = event;
    const logger = new StructuredLogger({
      service: 'worker',
      stdout: (line) => output.push(line),
    });

    logger.log(event);

    const line = output[0] ?? '';
    expect(line).not.toContain('Bearer exposed');
    expect(line).not.toContain('"exposed"');
    expect(JSON.parse(line)).toMatchObject({
      data: {
        authorization: '[REDACTED]',
        nested: { password: '[REDACTED]', workspaceId: 'workspace-1' },
        self: '[CIRCULAR]',
      },
      service: 'worker',
    });
  });

  it('routes failures to stderr and bounds oversized strings', () => {
    const errors: string[] = [];
    const logger = new StructuredLogger({
      service: 'api',
      stderr: (line) => errors.push(line),
    });

    logger.error('x'.repeat(5_000));

    expect(errors[0]).toContain('[truncated]');
    expect(JSON.parse(errors[0] ?? '')).toMatchObject({ level: 'error' });
  });

  it('redacts credential patterns embedded in provider messages', () => {
    const output: string[] = [];
    const logger = new StructuredLogger({
      service: 'api',
      stdout: (line) => output.push(line),
    });
    const stripeLikeSecret = ['sk', 'live', '1234567890abcdef'].join('_');
    const openAiKey = `sk-proj-${'a'.repeat(32)}`;
    const metaToken = `EAA${'b'.repeat(32)}`;
    const telegramToken = `123456789:${'c'.repeat(32)}`;
    const googleRefreshToken = `1//${'d'.repeat(32)}`;

    logger.log(
      `Bearer token-value failed at https://example.test?access_token=secret-value using ${stripeLikeSecret} ${openAiKey} ${metaToken} ${telegramToken} ${googleRefreshToken}`,
    );

    expect(output[0]).not.toContain('token-value');
    expect(output[0]).not.toContain('secret-value');
    expect(output[0]).not.toContain('1234567890abcdef');
    expect(output[0]).not.toContain('a'.repeat(32));
    expect(output[0]).not.toContain('b'.repeat(32));
    expect(output[0]).not.toContain('c'.repeat(32));
    expect(output[0]).not.toContain('d'.repeat(32));
    expect(output[0]).toContain('[REDACTED]');
  });
});
