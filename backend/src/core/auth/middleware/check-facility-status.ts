import { Request, Response, NextFunction } from 'express';
import { getFacilityStatus } from '@/core/super-admin/auth-queries.service';
import { ForbiddenError } from '@/lib/errors';

// Step 4: Facility status check.
// Skipped for super admin sessions (facilityId is null).

export async function checkFacilityStatus(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) {
    return next(new ForbiddenError('FORBIDDEN', 'Authentication required'));
  }

  if (req.auth.isSuperAdmin || req.auth.facilityId === null) {
    return next();
  }

  try {
    const status = await getFacilityStatus(req.auth.facilityId);

    if (status === null) {
      return next(new ForbiddenError('FACILITY_NOT_FOUND', 'Facility not found'));
    }
    if (status === 'suspended') {
      return next(new ForbiddenError('FACILITY_SUSPENDED', 'This facility is currently suspended'));
    }
    if (status === 'deactivated') {
      return next(new ForbiddenError('FACILITY_DEACTIVATED', 'This facility has been deactivated'));
    }

    return next();
  } catch (err) {
    return next(err);
  }
}
