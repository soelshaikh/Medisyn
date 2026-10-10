import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { authMiddleware } from '@/core/auth/auth.middleware';
import { requirePermission } from '@/core/auth/middleware/require-permission';
import { resolveFacility } from '@/middleware/resolve-facility';
import { AppError } from '@/lib/errors';
import {
  listPublicVaccineServices,
  listAdminVaccineServices,
  createVaccineService,
  updateVaccineServiceDetails,
} from './vaccine-service.service';
import {
  CreateVaccineServiceBodySchema,
  UpdateVaccineServiceBodySchema,
} from './vaccine-service.validator';

export const vaccineServiceRouter = Router();

function zodError(err: ZodError): AppError {
  const msg = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
  return new AppError('VALIDATION_ERROR', msg, 422);
}

// GET /vaccine-services/catalog — public, no auth
vaccineServiceRouter.get(
  '/vaccine-services/catalog',
  resolveFacility,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = res.locals.facilityId as string;
      const services = await listPublicVaccineServices(facilityId);
      res.json({ data: services });
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/vaccine-services — admin list (all, including inactive)
vaccineServiceRouter.get(
  '/admin/vaccine-services',
  ...authMiddleware,
  requirePermission('appointments.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const services = await listAdminVaccineServices(req.auth!);
      res.json({ data: services });
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/vaccine-services — create
vaccineServiceRouter.post(
  '/admin/vaccine-services',
  ...authMiddleware,
  requirePermission('appointments.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = CreateVaccineServiceBodySchema.parse(req.body);
      const service = await createVaccineService(req.auth!, body);
      res.status(201).json({ data: service });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// PATCH /admin/vaccine-services/:id — update
vaccineServiceRouter.patch(
  '/admin/vaccine-services/:id',
  ...authMiddleware,
  requirePermission('appointments.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = UpdateVaccineServiceBodySchema.parse(req.body);
      const service = await updateVaccineServiceDetails(req.auth!, req.params.id as string, body);
      res.json({ data: service });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);
