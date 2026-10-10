import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { authMiddleware, requirePermission } from '@/core/auth/auth.middleware';
import { AppError } from '@/lib/errors';
import {
  CreateCouponBodySchema,
  UpdateCouponBodySchema,
  ValidateCouponBodySchema,
} from './coupon.validator';
import {
  createCoupon,
  updateCoupon,
  deactivateCoupon,
  validateCoupon,
  getCouponById,
  listAllCoupons,
} from './coupon.service';

export const couponRouter = Router();

function zodError(err: ZodError): AppError {
  const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
  return new AppError('VALIDATION_ERROR', message, 422);
}

function getFacilityId(req: Request): string {
  const facilityId = req.auth?.facilityId;
  if (!facilityId) throw new AppError('FORBIDDEN', 'No facility context in token', 403);
  return facilityId;
}

// ── GET /coupons ──────────────────────────────────────────────────────────
couponRouter.get(
  '/',
  ...authMiddleware,
  requirePermission('coupons.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = getFacilityId(req);
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const active =
        req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;
      const search = (req.query.search as string) || undefined;

      const { rows, total } = await listAllCoupons(facilityId, { active, search, page, limit });
      res.json({
        data: rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /coupons/validate ────────────────────────────────────────────────
// Registered BEFORE /:id to prevent "validate" being treated as a UUID param.
// Auth required; no extra permission check — any logged-in user may validate.
couponRouter.post(
  '/validate',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = getFacilityId(req);
      const body = ValidateCouponBodySchema.parse(req.body);
      const result = await validateCoupon(facilityId, body);
      res.json({ data: result });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// ── POST /coupons ─────────────────────────────────────────────────────────
couponRouter.post(
  '/',
  ...authMiddleware,
  requirePermission('coupons.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = getFacilityId(req);
      const body = CreateCouponBodySchema.parse(req.body);
      const coupon = await createCoupon(facilityId, req.auth!.userId, body);
      res.status(201).json({ data: coupon });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// ── GET /coupons/:id ──────────────────────────────────────────────────────
couponRouter.get(
  '/:id',
  ...authMiddleware,
  requirePermission('coupons.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = getFacilityId(req);
      const coupon = await getCouponById(facilityId, req.params.id as string);
      res.json({ data: coupon });
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /coupons/:id ────────────────────────────────────────────────────
couponRouter.patch(
  '/:id',
  ...authMiddleware,
  requirePermission('coupons.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = getFacilityId(req);
      const body = UpdateCouponBodySchema.parse(req.body);
      const coupon = await updateCoupon(
        facilityId,
        req.auth!.userId,
        req.params.id as string,
        body,
      );
      res.json({ data: coupon });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// ── DELETE /coupons/:id ───────────────────────────────────────────────────
couponRouter.delete(
  '/:id',
  ...authMiddleware,
  requirePermission('coupons.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = getFacilityId(req);
      await deactivateCoupon(facilityId, req.auth!.userId, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
