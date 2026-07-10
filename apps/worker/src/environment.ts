const PRODUCTION_REQUIRED = [
  'DATABASE_URL',
  'REDIS_URL',
  'S3_REGION',
  'S3_BUCKET',
  'GEMINI_API_KEY',
] as const;

function valueOf(environment: Record<string, unknown>, name: string): string {
  const value = environment[name];
  return typeof value === 'string' ? value.trim() : '';
}

function validateUrl(
  environment: Record<string, unknown>,
  name: string,
  protocols: readonly string[],
): void {
  const configured = valueOf(environment, name);
  if (!configured) return;
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
  if (!protocols.includes(url.protocol)) {
    throw new Error(`${name} must use ${protocols.join(' or ')}.`);
  }
}

export function validateWorkerEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  if (valueOf(environment, 'NODE_ENV') === 'production') {
    const missing = PRODUCTION_REQUIRED.filter(
      (name) => valueOf(environment, name).length === 0,
    );
    if (missing.length > 0) {
      throw new Error(
        `Missing required production configuration: ${missing.join(', ')}`,
      );
    }
  }
  validateUrl(environment, 'DATABASE_URL', ['postgres:', 'postgresql:']);
  validateUrl(environment, 'REDIS_URL', ['redis:', 'rediss:']);
  validateUrl(environment, 'S3_ENDPOINT', ['http:', 'https:']);
  return environment;
}
