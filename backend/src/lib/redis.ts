import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// ── Redis client (cache) ──────────────────────────────────────────────────
// Used for performance cache + fast-path revocation flags.
// PostgreSQL is the source of truth — every Redis read has a DB fallback.

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 1,
  enableReadyCheck: false,
  lazyConnect: true,
  connectTimeout: 5000,
});

redis.on('error', (err) => {
  // Log but do not crash — Redis is a cache; DB fallback handles unavailability.
  console.error('[Redis] Connection error:', err.message);
});

// ── Redis client (BullMQ) ─────────────────────────────────────────────────
// BullMQ requires maxRetriesPerRequest: null for its blocking commands.
// Must be a separate connection from the cache client.

export const bullmqRedis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  connectTimeout: 5000,
});

bullmqRedis.on('error', (err) => {
  console.error('[BullMQ Redis] Connection error:', err.message);
});

// ── RedisUnavailableError ─────────────────────────────────────────────────
// Thrown when a Redis operation fails due to a connection problem (not a
// key-miss, which returns null normally).

export class RedisUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('Redis unavailable');
    this.name = 'RedisUnavailableError';
    if (cause instanceof Error) {
      this.cause = cause;
    }
  }
}

export function isRedisUnavailableError(err: unknown): err is RedisUnavailableError {
  return err instanceof RedisUnavailableError;
}

// ── Safe Redis helpers ────────────────────────────────────────────────────
// These wrap Redis commands and throw RedisUnavailableError on connection
// failures (not on logical misses, which return null).

export async function redisGet(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch (err) {
    throw new RedisUnavailableError(err);
  }
}

export async function redisSet(
  key: string,
  value: string,
  ttlSeconds?: number,
): Promise<void> {
  try {
    if (ttlSeconds !== undefined) {
      await redis.set(key, value, 'EX', ttlSeconds);
    } else {
      await redis.set(key, value);
    }
  } catch (err) {
    throw new RedisUnavailableError(err);
  }
}

export async function redisDel(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    throw new RedisUnavailableError(err);
  }
}
