const PRODUCTION_REQUIRED = [
  'DATABASE_URL',
  'REDIS_URL',
  'S3_REGION',
  'S3_BUCKET',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'AI_PROVIDER_CREDENTIALS_ENCRYPTION_KEY',
  'CHANNEL_CREDENTIALS_ENCRYPTION_KEY',
  'TELEGRAM_WEBHOOK_BASE_URL',
  'GOOGLE_GMAIL_CLIENT_ID',
  'GOOGLE_GMAIL_CLIENT_SECRET',
  'GMAIL_OAUTH_REDIRECT_URI',
  'WHATSAPP_WEBHOOK_BASE_URL',
  'META_MESSAGING_WEBHOOK_BASE_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_PRO_PRICE_ID',
  'STRIPE_WEBHOOK_SECRET',
  'WEB_APP_URL',
] as const;

function valueOf(environment: Record<string, unknown>, name: string): string {
  const value = environment[name];
  return typeof value === 'string' ? value.trim() : '';
}

function requireProductionValues(environment: Record<string, unknown>): void {
  if (valueOf(environment, 'NODE_ENV') !== 'production') return;

  const missing = PRODUCTION_REQUIRED.filter(
    (name) => valueOf(environment, name).length === 0,
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing required production configuration: ${missing.join(', ')}`,
    );
  }
}

function validatePort(environment: Record<string, unknown>): void {
  const configured = valueOf(environment, 'API_PORT');
  if (!configured) return;
  const port = Number(configured);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('API_PORT must be an integer from 1 to 65535.');
  }
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

function validateEncryptionKey(
  environment: Record<string, unknown>,
  name: string,
): void {
  const encoded = valueOf(environment, name);
  if (!encoded) return;
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encoded) {
    throw new Error(`${name} must be a base64-encoded 32-byte key.`);
  }
}

export function validateApiEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  requireProductionValues(environment);
  validatePort(environment);
  validateUrl(environment, 'DATABASE_URL', ['postgres:', 'postgresql:']);
  validateUrl(environment, 'REDIS_URL', ['redis:', 'rediss:']);
  validateUrl(environment, 'S3_ENDPOINT', ['http:', 'https:']);
  validateUrl(environment, 'WEB_APP_URL', ['http:', 'https:']);
  validateUrl(environment, 'TELEGRAM_WEBHOOK_BASE_URL', ['http:', 'https:']);
  validateUrl(environment, 'GMAIL_OAUTH_REDIRECT_URI', ['http:', 'https:']);
  validateUrl(environment, 'WHATSAPP_WEBHOOK_BASE_URL', ['http:', 'https:']);
  validateUrl(environment, 'META_MESSAGING_WEBHOOK_BASE_URL', [
    'http:',
    'https:',
  ]);
  validateEncryptionKey(environment, 'CHANNEL_CREDENTIALS_ENCRYPTION_KEY');
  validateEncryptionKey(environment, 'AI_PROVIDER_CREDENTIALS_ENCRYPTION_KEY');
  return environment;
}
