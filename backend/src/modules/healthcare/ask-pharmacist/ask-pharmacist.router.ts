import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { authMiddleware } from '@/core/auth/auth.middleware';
import { requirePermission } from '@/core/auth/middleware/require-permission';
import { AppError } from '@/lib/errors';
import {
  startConversation,
  listPatientConversations,
  getPatientConversationDetail,
  addPatientMessage,
  listAdminConversations,
  getAdminConversationDetail,
  addStaffMessage,
  assignConversation,
  changeConversationStatus,
  updateConversationNotesService,
} from './ask-pharmacist.service';
import {
  StartConversationBodySchema,
  AddMessageBodySchema,
  AssignConversationBodySchema,
  ConversationStatusBodySchema,
  UpdateConversationNotesBodySchema,
  ListConversationsQuerySchema,
  AdminListConversationsQuerySchema,
} from './ask-pharmacist.validator';

export const askPharmacistRouter = Router();

function zodError(err: ZodError): AppError {
  const msg = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
  return new AppError('VALIDATION_ERROR', msg, 422);
}

// POST /ask-pharmacist — patient starts a new conversation
askPharmacistRouter.post(
  '/ask-pharmacist',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = StartConversationBodySchema.parse(req.body);
      const result = await startConversation(req.auth!, body);
      res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /ask-pharmacist — list patient's own conversations
askPharmacistRouter.get(
  '/ask-pharmacist',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = ListConversationsQuerySchema.parse(req.query);
      const result = await listPatientConversations(req.auth!, query);
      res.json({ data: result.rows, pagination: result.pagination });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /ask-pharmacist/:id — patient conversation detail (no internalNotes)
askPharmacistRouter.get(
  '/ask-pharmacist/:id',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getPatientConversationDetail(req.auth!, req.params.id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// POST /ask-pharmacist/:id/messages — patient adds a message
askPharmacistRouter.post(
  '/ask-pharmacist/:id/messages',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = AddMessageBodySchema.parse(req.body);
      const result = await addPatientMessage(req.auth!, req.params.id as string, body);
      res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /admin/ask-pharmacist — admin list with filters
askPharmacistRouter.get(
  '/admin/ask-pharmacist',
  ...authMiddleware,
  requirePermission('ask-pharmacist.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = AdminListConversationsQuerySchema.parse(req.query);
      const result = await listAdminConversations(req.auth!, query);
      res.json({ data: result.rows, pagination: result.pagination });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /admin/ask-pharmacist/:id — admin conversation detail (internalNotes + patient info)
askPharmacistRouter.get(
  '/admin/ask-pharmacist/:id',
  ...authMiddleware,
  requirePermission('ask-pharmacist.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getAdminConversationDetail(req.auth!, req.params.id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/ask-pharmacist/:id/messages — staff adds a reply (auto-advances open→in_progress)
askPharmacistRouter.post(
  '/admin/ask-pharmacist/:id/messages',
  ...authMiddleware,
  requirePermission('ask-pharmacist.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = AddMessageBodySchema.parse(req.body);
      const result = await addStaffMessage(req.auth!, req.params.id as string, body);
      res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// POST /admin/ask-pharmacist/:id/assign — assign conversation to a staff member
askPharmacistRouter.post(
  '/admin/ask-pharmacist/:id/assign',
  ...authMiddleware,
  requirePermission('ask-pharmacist.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = AssignConversationBodySchema.parse(req.body);
      await assignConversation(req.auth!, req.params.id as string, body);
      res.json({ data: { success: true } });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// PATCH /admin/ask-pharmacist/:id/status — resolve or close conversation
askPharmacistRouter.patch(
  '/admin/ask-pharmacist/:id/status',
  ...authMiddleware,
  requirePermission('ask-pharmacist.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = ConversationStatusBodySchema.parse(req.body);
      await changeConversationStatus(req.auth!, req.params.id as string, body);
      res.json({ data: { success: true } });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// PATCH /admin/ask-pharmacist/:id/notes — update internal notes (never exposed to patient)
askPharmacistRouter.patch(
  '/admin/ask-pharmacist/:id/notes',
  ...authMiddleware,
  requirePermission('ask-pharmacist.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = UpdateConversationNotesBodySchema.parse(req.body);
      await updateConversationNotesService(req.auth!, req.params.id as string, body);
      res.json({ data: { success: true } });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);
