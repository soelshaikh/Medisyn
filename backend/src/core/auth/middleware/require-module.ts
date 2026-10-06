import { Request, Response, NextFunction, RequestHandler } from 'express';
import { getModuleAccess } from '@/core/super-admin/auth-queries.service';
import { ForbiddenError } from '@/lib/errors';

// Step 5: Module entitlement check.
// Module gate fires BEFORE permission check (step 6).

export function requireModule(moduleKey: string): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.auth) {
      return next(new ForbiddenError('FORBIDDEN', 'Authentication required'));
    }

    if (req.auth.isSuperAdmin) {
      return next();
    }

    if (!req.auth.facilityId) {
      return next(new ForbiddenError('FORBIDDEN', 'No facility context'));
    }

    try {
      const result = await getModuleAccess(req.auth.facilityId, moduleKey);

      if (result.access === 'denied') {
        return next(
          new ForbiddenError(
            result.code,
            result.code === 'MODULE_DISABLED'
              ? `Module "${moduleKey}" is disabled for this facility`
              : `Your plan does not include the "${moduleKey}" module`,
          ),
        );
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
}
