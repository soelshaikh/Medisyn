import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthError } from '@/lib/errors';

// ── AuthContext ────────────────────────────────────────────────────────────
// Attached to req.auth on every authenticated request.
// userId             → vtech-identity.users.id
// healthProfessionalId → vtech-core.health_professionals.id (null for super_admin + patient)
// facilityId         → vtech-core.facilities.id (null for super_admin)
// facilityPrefix     → short prefix of the facility (null for super_admin)
// accountType        → 'super_admin' | 'facility_user' | 'patient'
// roles              → facility_role enum values (empty for super_admin)
// permissions        → resolved permission_key enum values ('*' for super_admin)

export interface AuthContext {
  userId: string;
  sessionId: string;
  accountType: 'super_admin' | 'facility_user' | 'patient';
  healthProfessionalId: string | null;
  facilityId: string | null;
  facilityPrefix: string | null;
  authVersion: number;
  roles: string[];
  permissions: string[];
  // Convenience shorthands kept for backward compat with existing middleware
  isSuperAdmin: boolean;
  role: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
    id: string;
  }
}

interface JwtPayload {
  sub: string;                           // userId from vtech-identity
  sessionId: string;
  accountType: 'super_admin' | 'facility_user' | 'patient';
  healthProfessionalId?: string | null;
  facilityId?: string | null;
  facilityPrefix?: string | null;
  authVersion: number;
  roles: string[];
  permissions: string[];
  iat: number;
  exp: number;
}

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

    const isSuperAdmin = payload.accountType === 'super_admin';

    req.auth = {
      userId:               payload.sub,
      sessionId:            payload.sessionId,
      accountType:          payload.accountType ?? 'facility_user',
      healthProfessionalId: payload.healthProfessionalId ?? null,
      facilityId:           payload.facilityId ?? null,
      facilityPrefix:       payload.facilityPrefix ?? null,
      authVersion:          payload.authVersion,
      roles:                payload.roles ?? [],
      permissions:          payload.permissions ?? [],
      // Backward-compat shorthands
      isSuperAdmin,
      role: payload.roles?.[0] ?? (isSuperAdmin ? 'super_admin' : 'staff'),
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new AuthError('AUTH_TOKEN_EXPIRED', 'Your session has expired. Please log in again.'));
    }
    return next(new AuthError('AUTH_INVALID_TOKEN', 'Invalid authentication token'));
  }
}
