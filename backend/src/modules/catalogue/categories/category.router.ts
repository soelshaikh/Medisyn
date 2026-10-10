import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { authMiddleware, requirePermission } from '@/core/auth/auth.middleware';
import { resolveFacility } from '@/middleware/resolve-facility';
import { AppError } from '@/lib/errors';
import { CreateCategoryBodySchema, UpdateCategoryBodySchema } from './category.validator';
import {
  createCategory,
  updateCategory,
  deactivateCategory,
  getCategoryTree,
  getCategoryDetail,
} from './category.service';

export const categoryRouter = Router();

function zodError(err: ZodError): AppError {
  const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
  return new AppError('VALIDATION_ERROR', message, 422);
}

// ── GET /categories (public) ──────────────────────────────────────────────
categoryRouter.get(
  '/',
  resolveFacility,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = res.locals.facilityId as string;
      const tree = await getCategoryTree(facilityId);
      res.json({ data: tree });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /categories/:id (public) ──────────────────────────────────────────
categoryRouter.get(
  '/:id',
  resolveFacility,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = res.locals.facilityId as string;
      const data = await getCategoryDetail(facilityId, req.params.id as string);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /categories (admin) ──────────────────────────────────────────────
categoryRouter.post(
  '/',
  ...authMiddleware,
  requirePermission('categories.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = req.auth!.facilityId;
      if (!facilityId) {
        return next(new AppError('FORBIDDEN', 'No facility context in token', 403));
      }
      const body = CreateCategoryBodySchema.parse(req.body);
      const result = await createCategory(facilityId, req.auth!.userId, body);
      res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// ── PATCH /categories/:id (admin) ─────────────────────────────────────────
categoryRouter.patch(
  '/:id',
  ...authMiddleware,
  requirePermission('categories.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = req.auth!.facilityId;
      if (!facilityId) {
        return next(new AppError('FORBIDDEN', 'No facility context in token', 403));
      }
      const body = UpdateCategoryBodySchema.parse(req.body);
      const result = await updateCategory(
        facilityId,
        req.auth!.userId,
        req.params.id as string,
        body,
      );
      res.json({ data: result });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// ── DELETE /categories/:id (admin) — soft deactivate ─────────────────────
categoryRouter.delete(
  '/:id',
  ...authMiddleware,
  requirePermission('categories.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = req.auth!.facilityId;
      if (!facilityId) {
        return next(new AppError('FORBIDDEN', 'No facility context in token', 403));
      }
      const result = await deactivateCategory(
        facilityId,
        req.auth!.userId,
        req.params.id as string,
      );
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);
