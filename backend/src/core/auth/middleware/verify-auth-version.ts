import { Request, Response, NextFunction } from 'express';
import { getCurrentAuthVersion, cacheAuthVersion } from '@/core/super-admin/auth-queries.service';
import { redisGet, isRedisUnavailableError } from '@/lib/redis';
import { AuthError, ServiceUnavailableError } from '@/lib/errors';

// Step 3: Auth-version staleness check.
// Fallback chain (fail-closed):
//   1. Check Redis auth_version:{userId} (60s TTL)
//   2. Cache miss or Redis unavailable → query users.auth_version via service
//   3. Both unavailable → 503

export async function verifyAuthVersion(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) {
    return next(new AuthError('AUTH_MISSING', 'Authentication required'));
  }

  const { userId, authVersion: jwtAuthVersion } = req.auth;
  let currentAuthVersion: number | null = null;
  let redisAvailable = true;

  // Step 1: Try Redis cache
  try {
    const cached = await redisGet(`auth_version:${userId}`);
    if (cached !== null) {
      currentAuthVersion = parseInt(cached, 10);
    }
  } catch (err) {
    if (!isRedisUnavailableError(err)) {
      return next(err as Error);
    }
    redisAvailable = false;
  }

  // Step 2: DB fallback
  if (currentAuthVersion === null) {
    try {
      const version = await getCurrentAuthVersion(userId);
      if (version === null) {
        return next(new AuthError('AUTH_INVALID_TOKEN', 'User not found'));
      }
      currentAuthVersion = version;

      if (redisAvailable) {
        await cacheAuthVersion(userId, currentAuthVersion);
      }
    } catch {
      return next(new ServiceUnavailableError('SERVICE_UNAVAILABLE', 'Unable to verify authorization. Please try again shortly.'));
    }
  }

  if (currentAuthVersion > jwtAuthVersion) {
    return next(new AuthError('AUTH_VERSION_STALE', 'Your permissions have changed. Please log in again.'));
  }

  return next();
}
