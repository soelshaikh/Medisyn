import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { authMiddleware } from '@/core/auth/auth.middleware';
import { requirePermission } from '@/core/auth/middleware/require-permission';
import { AppError } from '@/lib/errors';
import {
  listPatientOrders,
  getPatientOrderDetail,
  cancelPatientOrder,
  listAdminOrders,
  getAdminOrderDetail,
  advanceOrderStatus,
  adminCancelOrder,
  updateAdminOrderNotes,
} from './order.service';
import {
  ListPatientOrdersQuerySchema,
  ListAdminOrdersQuerySchema,
  AdvanceStatusBodySchema,
  UpdateNotesBodySchema,
  CancelOrderBodySchema,
} from './order.validator';
import type { OrderStatus } from './order.types';

export const orderRouter = Router();

function zodError(err: ZodError): AppError {
  const msg = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
  return new AppError('VALIDATION_ERROR', msg, 422);
}

// ── Patient order routes ──────────────────────────────────────────────────

// GET /orders — list patient's own orders
orderRouter.get(
  '/orders',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = ListPatientOrdersQuerySchema.parse(req.query);
      const result = await listPatientOrders(req.auth!, {
        status: query.status as OrderStatus | undefined,
        page: query.page,
        limit: query.limit,
      });
      res.json({ data: result.rows, pagination: result.pagination });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /orders/:id — patient order detail (no internal notes)
orderRouter.get(
  '/orders/:id',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await getPatientOrderDetail(req.auth!, req.params.id as string);
      res.json({ data: order });
    } catch (err) {
      next(err);
    }
  },
);

// POST /orders/:id/cancel — patient self-cancellation (pending only)
orderRouter.post(
  '/orders/:id/cancel',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await cancelPatientOrder(req.auth!, req.params.id as string);
      res.json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  },
);

// ── Admin order routes ────────────────────────────────────────────────────

// GET /admin/orders — list all orders with filters
orderRouter.get(
  '/admin/orders',
  ...authMiddleware,
  requirePermission('orders.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = ListAdminOrdersQuerySchema.parse(req.query);
      const result = await listAdminOrders(req.auth!, {
        status: query.status as OrderStatus | undefined,
        patientId: query.patientId,
        orderNumber: query.orderNumber,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        page: query.page,
        limit: query.limit,
        sort: query.sort as 'createdAt:asc' | 'createdAt:desc' | 'total:asc' | 'total:desc',
      });
      res.json({ data: result.rows, pagination: result.pagination });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /admin/orders/:id — admin order detail (includes notes + patient info)
orderRouter.get(
  '/admin/orders/:id',
  ...authMiddleware,
  requirePermission('orders.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await getAdminOrderDetail(req.auth!, req.params.id as string);
      res.json({ data: order });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /admin/orders/:id/status — advance order through lifecycle
orderRouter.patch(
  '/admin/orders/:id/status',
  ...authMiddleware,
  requirePermission('orders.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = AdvanceStatusBodySchema.parse(req.body);
      await advanceOrderStatus(req.auth!, req.params.id as string, body.newStatus as OrderStatus, body.note);
      res.json({ data: { success: true } });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// POST /admin/orders/:id/cancel — admin-initiated cancellation
orderRouter.post(
  '/admin/orders/:id/cancel',
  ...authMiddleware,
  requirePermission('orders.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = CancelOrderBodySchema.parse(req.body);
      await adminCancelOrder(req.auth!, req.params.id as string, body.note);
      res.json({ data: { success: true } });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// PATCH /admin/orders/:id/notes — update internal notes (never exposed to patient)
orderRouter.patch(
  '/admin/orders/:id/notes',
  ...authMiddleware,
  requirePermission('orders.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = UpdateNotesBodySchema.parse(req.body);
      await updateAdminOrderNotes(req.auth!, req.params.id as string, body.notes);
      res.json({ data: { success: true } });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);
