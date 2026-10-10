import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { authMiddleware, requirePermission } from '@/core/auth/auth.middleware';
import { AppError } from '@/lib/errors';
import {
  AdjustBodySchema,
  PaginationQuerySchema,
  InventoryHistoryQuerySchema,
} from './inventory.validator';
import {
  adjustInventory,
  getInventoryStatus,
  getLowStock,
  getHistory,
} from './inventory.service';

export const inventoryRouter = Router();

function zodError(err: ZodError): AppError {
  const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
  return new AppError('VALIDATION_ERROR', message, 422);
}

function requireFacilityId(req: Request): string {
  const facilityId = req.auth!.facilityId;
  if (!facilityId) throw new AppError('FORBIDDEN', 'No facility context in token', 403);
  return facilityId;
}

// ── GET /inventory/products/:productId ────────────────────────────────────
inventoryRouter.get(
  '/products/:productId',
  ...authMiddleware,
  requirePermission('inventory.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = requireFacilityId(req);
      const data = await getInventoryStatus(facilityId, req.params.productId as string);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /inventory/low-stock ──────────────────────────────────────────────
inventoryRouter.get(
  '/low-stock',
  ...authMiddleware,
  requirePermission('inventory.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = requireFacilityId(req);
      const { page, limit } = PaginationQuerySchema.parse(req.query);
      const { rows, total } = await getLowStock(facilityId, page, limit);
      res.json({
        data: rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// ── POST /inventory/products/:productId/adjust ────────────────────────────
inventoryRouter.post(
  '/products/:productId/adjust',
  ...authMiddleware,
  requirePermission('inventory.adjust'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = requireFacilityId(req);
      const body = AdjustBodySchema.parse(req.body);
      const transaction = await adjustInventory(
        facilityId,
        req.auth!.userId,
        req.params.productId as string,
        body,
      );
      res.json({ data: transaction });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// ── GET /inventory/products/:productId/history ────────────────────────────
inventoryRouter.get(
  '/products/:productId/history',
  ...authMiddleware,
  requirePermission('inventory.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = requireFacilityId(req);
      const query = InventoryHistoryQuerySchema.parse(req.query);
      const { rows, total } = await getHistory(
        facilityId,
        req.params.productId as string,
        query.variant_id,
        query.page,
        query.limit,
      );
      res.json({
        data: rows,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);
