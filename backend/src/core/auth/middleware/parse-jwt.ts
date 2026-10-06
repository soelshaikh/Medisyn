import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthError } from '@/lib/errors';

export interface AuthContext {
  userId: string;
  sessionId: string;
  facilityId: string | null;
  authVersion: number;
  role: string;
  isSuperAdmin: boolean;
}

// Augment Express Request with auth context and request ID
declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
    id: string;
  }
}

interface JwtPayload {
  sub: string;
  sessionId: string;
  facilityId?: string | null;
  authVersion: number;
  role: string;
  isSuperAdmin?: boolean;
  iat: number;
  exp: number;
}

// Step 1: Parse and verify JWT signature + expiry.
// Attaches req.auth on success.
export function parseJWT(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header) {
    return next(new AuthError('AUTH_MISSING', 'Authorization header is required'));
  }

  if (!header.startsWith('Bearer ')) {
    return next(new AuthError('AUTH_MALFORMED', 'Authorization header must use Bearer scheme'));
  }

  const token = header.slice(7);
  if (!token) {
    return next(new AuthError('AUTH_MALFORMED', 'Bearer token is missing'));
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return next(new AuthError('AUTH_INVALID_TOKEN', 'JWT secret not configured'));
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;

    if (!payload.sub || !payload.sessionId || payload.authVersion === undefined) {
      return next(new AuthError('AUTH_INVALID_TOKEN', 'Token is missing required claims'));
    }

    req.auth = {
      userId: payload.sub,
      sessionId: payload.sessionId,
      facilityId: payload.facilityId ?? null,
      authVersion: payload.authVersion,
      role: payload.role ?? 'staff',
      isSuperAdmin: payload.isSuperAdmin ?? false,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new AuthError('AUTH_TOKEN_EXPIRED', 'Your session has expired. Please log in again.'));
    }
    return next(new AuthError('AUTH_INVALID_TOKEN', 'Invalid authentication token'));
  }
}
