import { Request, Response, NextFunction, RequestHandler } from 'express';

// Step 6: RBAC permission check.
// Full implementation in Phase 2 (post-Phase-1 scope).
// Stub factory: returns middleware that calls next() unconditionally.
export function requirePermission(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _permissionKey: string,
): RequestHandler {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    // TODO Phase 2: check facility_role_permissions for required permission key
    next();
  };
}
