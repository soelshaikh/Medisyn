import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { authMiddleware } from '@/core/auth/auth.middleware';
import { requirePermission } from '@/core/auth/middleware/require-permission';
import { AppError } from '@/lib/errors';
import {
  bookAppointment,
  listMyAppointments,
  getMyAppointmentDetail,
  cancelMyAppointment,
  listAdminAppointmentList,
  getAdminAppointmentDetail,
  changeAppointmentStatus,
  updateAppointmentNotes,
} from './appointment.service';
import {
  BookAppointmentBodySchema,
  CancelAppointmentBodySchema,
  ListPatientAppointmentsQuerySchema,
  AdminListAppointmentsQuerySchema,
  AdminUpdateStatusBodySchema,
  AdminUpdateNotesBodySchema,
} from './appointment.validator';

export const appointmentRouter = Router();

function zodError(err: ZodError): AppError {
  const msg = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
  return new AppError('VALIDATION_ERROR', msg, 422);
}

// POST /appointments — book an appointment
appointmentRouter.post(
  '/appointments',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = BookAppointmentBodySchema.parse(req.body);
      const result = await bookAppointment(req.auth!, body);
      res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /appointments — list patient's own appointments
appointmentRouter.get(
  '/appointments',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = ListPatientAppointmentsQuerySchema.parse(req.query);
      const result = await listMyAppointments(req.auth!, query);
      res.json({ data: result.rows, pagination: result.pagination });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /appointments/:id — patient appointment detail (no internalNotes)
appointmentRouter.get(
  '/appointments/:id',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getMyAppointmentDetail(req.auth!, req.params.id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// POST /appointments/:id/cancel — patient cancels own appointment
appointmentRouter.post(
  '/appointments/:id/cancel',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = CancelAppointmentBodySchema.parse(req.body);
      await cancelMyAppointment(req.auth!, req.params.id as string, body);
      res.json({ data: { success: true } });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /admin/appointments — admin list with filters
appointmentRouter.get(
  '/admin/appointments',
  ...authMiddleware,
  requirePermission('appointments.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = AdminListAppointmentsQuerySchema.parse(req.query);
      const result = await listAdminAppointmentList(req.auth!, query);
      res.json({ data: result.rows, pagination: result.pagination });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /admin/appointments/:id — admin detail (internalNotes + patient info)
appointmentRouter.get(
  '/admin/appointments/:id',
  ...authMiddleware,
  requirePermission('appointments.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getAdminAppointmentDetail(req.auth!, req.params.id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /admin/appointments/:id/status — admin changes status
appointmentRouter.patch(
  '/admin/appointments/:id/status',
  ...authMiddleware,
  requirePermission('appointments.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = AdminUpdateStatusBodySchema.parse(req.body);
      await changeAppointmentStatus(req.auth!, req.params.id as string, body);
      res.json({ data: { success: true } });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// PATCH /admin/appointments/:id/notes — admin internal notes (never exposed to patient)
appointmentRouter.patch(
  '/admin/appointments/:id/notes',
  ...authMiddleware,
  requirePermission('appointments.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = AdminUpdateNotesBodySchema.parse(req.body);
      await updateAppointmentNotes(req.auth!, req.params.id as string, body);
      res.json({ data: { success: true } });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);
