import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { authMiddleware } from '@/core/auth/auth.middleware';
import { requirePermission } from '@/core/auth/middleware/require-permission';
import { AppError } from '@/lib/errors';
import {
  submitPrescription,
  listPatientPrescriptions,
  getPatientPrescriptionDetail,
  listAdminPrescriptions,
  getAdminPrescriptionDetail,
  updatePrescriptionStatus,
} from './prescription.service';
import {
  CreatePrescriptionBodySchema,
  ListPrescriptionsQuerySchema,
  AdminListPrescriptionsQuerySchema,
  AdminPrescriptionStatusBodySchema,
} from './prescription.validator';

export const prescriptionRouter = Router();

function zodError(err: ZodError): AppError {
  const msg = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
  return new AppError('VALIDATION_ERROR', msg, 422);
}

// POST /prescriptions — patient submits a prescription request
prescriptionRouter.post(
  '/prescriptions',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = CreatePrescriptionBodySchema.parse(req.body);
      const result = await submitPrescription(req.auth!, body);
      res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /prescriptions — list patient's own prescription requests
prescriptionRouter.get(
  '/prescriptions',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = ListPrescriptionsQuerySchema.parse(req.query);
      const result = await listPatientPrescriptions(req.auth!, query);
      res.json({ data: result.rows, pagination: result.pagination });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /prescriptions/:id — patient detail (no internalNotes)
prescriptionRouter.get(
  '/prescriptions/:id',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getPatientPrescriptionDetail(req.auth!, req.params.id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/prescriptions — admin list with filters
prescriptionRouter.get(
  '/admin/prescriptions',
  ...authMiddleware,
  requirePermission('prescriptions.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = AdminListPrescriptionsQuerySchema.parse(req.query);
      const result = await listAdminPrescriptions(req.auth!, query);
      res.json({ data: result.rows, pagination: result.pagination });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /admin/prescriptions/:id — admin detail (includes internalNotes + patient info)
prescriptionRouter.get(
  '/admin/prescriptions/:id',
  ...authMiddleware,
  requirePermission('prescriptions.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getAdminPrescriptionDetail(req.auth!, req.params.id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /admin/prescriptions/:id/status — admin approve/decline with notes
prescriptionRouter.patch(
  '/admin/prescriptions/:id/status',
  ...authMiddleware,
  requirePermission('prescriptions.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = AdminPrescriptionStatusBodySchema.parse(req.body);
      await updatePrescriptionStatus(req.auth!, req.params.id as string, body);
      res.json({ data: { success: true } });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);
