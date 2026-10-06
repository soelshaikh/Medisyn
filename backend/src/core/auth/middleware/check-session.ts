import { Request, Response, NextFunction } from 'express';
import { getSessionRevocationState } from '@/core/super-admin/auth-queries.service';
import { redisGet, isRedisUnavailableError } from '@/lib/redis';
import { AuthError, ServiceUnavailableError } from '@/lib/errors';

// Step 2: Session revocation check.
// Fallback chain (fail-closed):
//   1. Redis key revoked_session:{sessionId} → 401 if present
//   2. Redis unavailable → query sessions table via superAdminDb service
//   3. Both unavailable → 503

export async function checkSession(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) {
    return next(new AuthError('AUTH_MISSING', 'Authentication required'));
  }

  const { sessionId } = req.auth;

  // Step 1: Fast-path Redis revocation check
  try {
    const revoked = await redisGet(`revoked_session:${sessionId}`);
    if (revoked !== null) {
      return next(new AuthError('SESSION_REVOKED', 'This session has been revoked. Please log in again.'));
    }
  } catch (err) {
    if (!isRedisUnavailableError(err)) {
      return next(err as Error);
    }
    // Redis unavailable — fall through to DB
  }

  // Step 2: DB authoritative check via super-admin service
  try {
    const { exists, revokedAt } = await getSessionRevocationState(sessionId);

    if (!exists || revokedAt !== null) {
      return next(new AuthError('SESSION_REVOKED', 'This session has been revoked. Please log in again.'));
    }

    return next();
  } catch {
    // Both Redis and DB unavailable — fail closed
    return next(new ServiceUnavailableError('SERVICE_UNAVAILABLE', 'Unable to verify session. Please try again shortly.'));
  }
}
