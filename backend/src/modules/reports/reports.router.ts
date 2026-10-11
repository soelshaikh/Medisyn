import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { authMiddleware } from '@/core/auth/auth.middleware';
import { requirePermission } from '@/core/auth/middleware/require-permission';
import { AppError } from '@/lib/errors';
import { ReportQuerySchema } from './reports.validator';
import {
  getSalesReport,
  getOrderReport,
  getPatientReport,
  getDashboard,
} from './reports.service';

export const reportsRouter = Router();

function zodError(err: ZodError): AppError {
  const msg = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
  return new AppError('VALIDATION_ERROR', msg, 422);
}

// GET /admin/reports/sales
reportsRouter.get(
  '/sales',
  ...authMiddleware,
  requirePermission('reports.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = ReportQuerySchema.parse(req.query);
      const result = await getSalesReport(req.auth!, query);
      res.json({ data: result });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /admin/reports/orders
reportsRouter.get(
  '/orders',
  ...authMiddleware,
  requirePermission('reports.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = ReportQuerySchema.parse(req.query);
      const result = await getOrderReport(req.auth!, query);
      res.json({ data: result });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /admin/reports/patients
reportsRouter.get(
  '/patients',
  ...authMiddleware,
  requirePermission('reports.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = ReportQuerySchema.parse(req.query);
      const result = await getPatientReport(req.auth!, query);
      res.json({ data: result });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /admin/reports/dashboard
reportsRouter.get(
  '/dashboard',
  ...authMiddleware,
  requirePermission('reports.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getDashboard(req.auth!);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);
