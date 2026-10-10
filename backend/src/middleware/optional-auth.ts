import { Request, Response, NextFunction } from 'express';
import { parseJWT } from '@/core/auth/middleware/parse-jwt';
import { checkSession } from '@/core/auth/middleware/check-session';
import { verifyAuthVersion } from '@/core/auth/middleware/verify-auth-version';
import { checkFacilityStatus } from '@/core/auth/middleware/check-facility-status';

// optionalAuth — runs the full auth chain only when Authorization header is present.
// Guest requests (no header) pass through with req.auth undefined.
// If a token is provided, all normal auth checks apply (signature, session, version, facility).
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.headers.authorization) {
    return next();
  }

  parseJWT(req, res, (err) => {
    if (err) return next(err);
    checkSession(req, res, (err2) => {
      if (err2) return next(err2);
      verifyAuthVersion(req, res, (err3) => {
        if (err3) return next(err3);
        checkFacilityStatus(req, res, next);
      });
    });
  });
}
