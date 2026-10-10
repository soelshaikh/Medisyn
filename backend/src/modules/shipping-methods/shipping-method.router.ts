import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { authMiddleware, requirePermission } from '@/core/auth/auth.middleware';
import { resolveFacility } from '@/middleware/resolve-facility';
import { AppError } from '@/lib/errors';
import { listActive, listAll, create, update, deactivate } from './shipping-method.service';
import {
  CreateShippingMethodBodySchema,
  UpdateShippingMethodBodySchema,
} from './shipping-method.validator';

export const shippingMethodRouter = Router();

function zodError(err: ZodError): AppError {
  const msg = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
  return new AppError('VALIDATION_ERROR', msg, 422);
}

// ── GET /shipping-methods (public) ────────────────────────────────────────
shippingMethodRouter.get(
  '/shipping-methods',
  resolveFacility,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = res.locals.facilityId as string;
      const methods = await listActive(facilityId);
      res.json({ data: methods });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /admin/shipping-methods ───────────────────────────────────────────
shippingMethodRouter.get(
  '/admin/shipping-methods',
  ...authMiddleware,
  requirePermission('shipping-methods.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = req.auth!.facilityId;
      if (!facilityId) return next(new AppError('FORBIDDEN', 'No facility context', 403));
      const methods = await listAll(facilityId);
      res.json({ data: methods });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /admin/shipping-methods ──────────────────────────────────────────
shippingMethodRouter.post(
  '/admin/shipping-methods',
  ...authMiddleware,
  requirePermission('shipping-methods.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = req.auth!.facilityId;
      if (!facilityId) return next(new AppError('FORBIDDEN', 'No facility context', 403));
      const body = CreateShippingMethodBodySchema.parse(req.body);
      const method = await create(facilityId, body, req.auth!.userId);
      res.status(201).json({ data: method });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// ── PATCH /admin/shipping-methods/:id ────────────────────────────────────
shippingMethodRouter.patch(
  '/admin/shipping-methods/:id',
  ...authMiddleware,
  requirePermission('shipping-methods.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = req.auth!.facilityId;
      if (!facilityId) return next(new AppError('FORBIDDEN', 'No facility context', 403));
      const body = UpdateShippingMethodBodySchema.parse(req.body);
      const method = await update(facilityId, req.params.id as string, body, req.auth!.userId);
      res.json({ data: method });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// ── PATCH /admin/shipping-methods/:id/deactivate ──────────────────────────
shippingMethodRouter.patch(
  '/admin/shipping-methods/:id/deactivate',
  ...authMiddleware,
  requirePermission('shipping-methods.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = req.auth!.facilityId;
      if (!facilityId) return next(new AppError('FORBIDDEN', 'No facility context', 403));
      await deactivate(facilityId, req.params.id as string, req.auth!.userId);
      res.json({ data: { message: 'Shipping method deactivated' } });
    } catch (err) {
      next(err);
    }
  },
);
