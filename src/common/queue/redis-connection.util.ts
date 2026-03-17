import { RedisOptions } from 'ioredis';

const REDIS_PROTOCOL = 'redis:';
const REDIS_TLS_PROTOCOL = 'rediss:';

export function buildRedisConnectionFromUrl(url: string): RedisOptions {
  const parsed = new URL(url);

  if (
    parsed.protocol !== REDIS_PROTOCOL &&
    parsed.protocol !== REDIS_TLS_PROTOCOL
  ) {
    throw new Error(`Invalid redis protocol: ${parsed.protocol}`);
  }

  const dbFromPath = parsed.pathname.replace(/^\//, '');

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: dbFromPath ? Number(dbFromPath) : undefined,
    tls: parsed.protocol === REDIS_TLS_PROTOCOL ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}
