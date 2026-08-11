const SENSITIVE_KEY =
  /authorization|cookie|credential|password|private.?key|secret|session|token/i;
const MAX_DEPTH = 5;
const MAX_ARRAY_ITEMS = 25;
const MAX_STRING_LENGTH = 4_000;

type LogLevel = 'debug' | 'error' | 'fatal' | 'info' | 'warn';
type LogWriter = (line: string) => void;

export interface StructuredLoggerOptions {
  clock?: () => Date;
  service: string;
  stderr?: LogWriter;
  stdout?: LogWriter;
}

function truncate(value: string): string {
  const redacted = value
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[REDACTED]')
    .replace(/(AIza)[0-9A-Za-z_-]{20,}/g, '$1[REDACTED]')
    .replace(/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}\b/g, 'sk-[REDACTED]')
    .replace(/(sk_(?:live|test)_|whsec_)[0-9A-Za-z]+/g, '$1[REDACTED]')
    .replace(/\bEAA[A-Za-z0-9_-]{20,}\b/g, 'EAA[REDACTED]')
    .replace(/\b\d{6,12}:[A-Za-z0-9_-]{20,}\b/g, '[TELEGRAM_TOKEN_REDACTED]')
    .replace(/\b1\/\/[A-Za-z0-9_-]{20,}\b/g, '1//[REDACTED]')
    .replace(
      /([?&](?:access_token|api_key|key|secret|token)=)[^&#\s]+/gi,
      '$1[REDACTED]',
    );
  return redacted.length <= MAX_STRING_LENGTH
    ? redacted
    : `${redacted.slice(0, MAX_STRING_LENGTH)}…[truncated]`;
}

function sanitize(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (typeof value === 'string') return truncate(value);
  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'undefined') return null;
  if (typeof value === 'function' || typeof value === 'symbol') {
    return `[${typeof value}]`;
  }
  if (depth >= MAX_DEPTH) return '[MAX_DEPTH]';
  if (value instanceof Error) {
    return {
      message: truncate(value.message),
      name: value.name,
      ...(value.stack ? { stack: truncate(value.stack) } : {}),
    };
  }
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitize(item, depth + 1, seen));
  }
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY.test(key)
      ? '[REDACTED]'
      : sanitize(child, depth + 1, seen);
  }
  return result;
}

function contextFrom(optional: readonly unknown[]): string | undefined {
  const candidate = optional.at(-1);
  return typeof candidate === 'string' && !candidate.includes('\n')
    ? truncate(candidate)
    : undefined;
}

export class StructuredLogger {
  private readonly clock: () => Date;
  private readonly stderr: LogWriter;
  private readonly stdout: LogWriter;

  constructor(private readonly options: StructuredLoggerOptions) {
    this.clock = options.clock ?? (() => new Date());
    this.stderr =
      options.stderr ?? ((line) => process.stderr.write(`${line}\n`));
    this.stdout =
      options.stdout ?? ((line) => process.stdout.write(`${line}\n`));
  }

  debug(message: unknown, ...optional: unknown[]): void {
    this.emit('debug', message, optional);
  }

  error(message: unknown, ...optional: unknown[]): void {
    this.emit('error', message, optional);
  }

  fatal(message: unknown, ...optional: unknown[]): void {
    this.emit('fatal', message, optional);
  }

  log(message: unknown, ...optional: unknown[]): void {
    this.emit('info', message, optional);
  }

  verbose(message: unknown, ...optional: unknown[]): void {
    this.emit('debug', message, optional);
  }

  warn(message: unknown, ...optional: unknown[]): void {
    this.emit('warn', message, optional);
  }

  private emit(
    level: LogLevel,
    message: unknown,
    optional: readonly unknown[],
  ): void {
    const context = contextFrom(optional);
    const record = {
      ...(context ? { context } : {}),
      level,
      ...(typeof message === 'string'
        ? { message: truncate(message) }
        : { data: sanitize(message), message: 'Structured event' }),
      service: this.options.service,
      timestamp: this.clock().toISOString(),
    };
    const line = JSON.stringify(record);
    if (level === 'error' || level === 'fatal') this.stderr(line);
    else this.stdout(line);
  }
}
