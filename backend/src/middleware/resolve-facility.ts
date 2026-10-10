import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { superAdminDb } from '@/db';
import { facilities } from '@/db/schema/core';
import { AppError } from '@/lib/errors';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// resolveFacility — reads X-Facility-ID header, validates it, confirms the facility
// is active, and attaches facilityId to res.locals for use by route handlers.
// Used on public catalogue endpoints where no JWT is present.
export async function resolveFacility(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const raw = req.headers['x-facility-id'];

  if (!raw || typeof raw !== 'string' || raw.trim() === '') {
    return next(new AppError('MISSING_FACILITY_ID', 'X-Facility-ID header is required', 400));
  }

  const id = raw.trim();

  if (!UUID_RE.test(id)) {
    return next(new AppError('INVALID_FACILITY_ID', 'X-Facility-ID must be a valid UUID', 400));
  }

  const [facility] = await superAdminDb
    .select({ id: facilities.id, status: facilities.status })
    .from(facilities)
    .where(eq(facilities.id, id))
    .limit(1);

  if (!facility) {
    return next(new AppError('FACILITY_NOT_FOUND', 'Facility not found', 404));
  }

  if (facility.status === 'suspended' || facility.status === 'deactivated') {
    return next(new AppError('FACILITY_SUSPENDED', 'Facility is suspended', 403));
  }

  res.locals.facilityId = facility.id;
  next();
}
