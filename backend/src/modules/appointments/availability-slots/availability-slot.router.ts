import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { authMiddleware } from '@/core/auth/auth.middleware';
import { requirePermission } from '@/core/auth/middleware/require-permission';
import { resolveFacility } from '@/middleware/resolve-facility';
import { AppError } from '@/lib/errors';
import {
  browseAvailableSlots,
  listAdminAvailabilitySlots,
  createAvailabilitySlot,
  updateAvailabilitySlotDetails,
} from './availability-slot.service';
import {
  AdminListSlotsQuerySchema,
  CreateAvailabilitySlotBodySchema,
  UpdateAvailabilitySlotBodySchema,
  PatientAvailabilityQuerySchema,
} from './availability-slot.validator';

export const availabilitySlotRouter = Router();

function zodError(err: ZodError): AppError {
  const msg = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
  return new AppError('VALIDATION_ERROR', msg, 422);
}

// GET /appointments/availability — patient browses available slots (public auth)
availabilitySlotRouter.get(
  '/appointments/availability',
  resolveFacility,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = res.locals.facilityId as string;
      const query = PatientAvailabilityQuerySchema.parse(req.query);
      const slots = await browseAvailableSlots(facilityId, query);
      res.json({ data: slots });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /admin/availability-slots — admin list with filters
availabilitySlotRouter.get(
  '/admin/availability-slots',
  ...authMiddleware,
  requirePermission('appointments.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = AdminListSlotsQuerySchema.parse(req.query);
      const result = await listAdminAvailabilitySlots(req.auth!, query);
      res.json({ data: result.rows, pagination: result.pagination });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// POST /admin/availability-slots — create slot
availabilitySlotRouter.post(
  '/admin/availability-slots',
  ...authMiddleware,
  requirePermission('appointments.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = CreateAvailabilitySlotBodySchema.parse(req.body);
      const slot = await createAvailabilitySlot(req.auth!, body);
      res.status(201).json({ data: slot });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// PATCH /admin/availability-slots/:id — update slot
availabilitySlotRouter.patch(
  '/admin/availability-slots/:id',
  ...authMiddleware,
  requirePermission('appointments.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = UpdateAvailabilitySlotBodySchema.parse(req.body);
      const slot = await updateAvailabilitySlotDetails(req.auth!, req.params.id as string, body);
      res.json({ data: slot });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);
