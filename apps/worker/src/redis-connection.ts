import type { ConnectionOptions } from 'bullmq';

export function redisConnection(): ConnectionOptions {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:56379');
  const database = url.pathname.slice(1);

  return {
    db: database ? Number(database) : 0,
    host: url.hostname,
    maxRetriesPerRequest: null,
    ...(url.password ? { password: url.password } : {}),
    port: Number(url.port || 6379),
    ...(url.username ? { username: url.username } : {}),
  };
}
