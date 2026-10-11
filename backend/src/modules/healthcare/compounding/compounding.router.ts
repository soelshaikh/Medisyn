import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { authMiddleware } from '@/core/auth/auth.middleware';
import { requirePermission } from '@/core/auth/middleware/require-permission';
import { AppError } from '@/lib/errors';
import {
  submitCompounding,
  listPatientCompounding,
  getPatientCompoundingDetail,
  acceptQuote,
  declineQuote,
  listAdminCompounding,
  getAdminCompoundingDetail,
  adminUpdateCompoundingStatus,
  uploadCompoundingFile,
  getCompoundingFileUrl,
} from './compounding.service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.FILE_MAX_SIZE_BYTES ?? 10_485_760) },
});
import {
  CreateCompoundingBodySchema,
  ListCompoundingQuerySchema,
  AdminListCompoundingQuerySchema,
  AdminCompoundingStatusBodySchema,
  DeclineQuoteBodySchema,
} from './compounding.validator';

export const compoundingRouter = Router();

function zodError(err: ZodError): AppError {
  const msg = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
  return new AppError('VALIDATION_ERROR', msg, 422);
}

// POST /compounding — patient submits a compounding request
compoundingRouter.post(
  '/compounding',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = CreateCompoundingBodySchema.parse(req.body);
      const result = await submitCompounding(req.auth!, body);
      res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /compounding — list patient's own compounding requests
compoundingRouter.get(
  '/compounding',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = ListCompoundingQuerySchema.parse(req.query);
      const result = await listPatientCompounding(req.auth!, query);
      res.json({ data: result.rows, pagination: result.pagination });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /compounding/:id — patient detail (no internalNotes)
compoundingRouter.get(
  '/compounding/:id',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getPatientCompoundingDetail(req.auth!, req.params.id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// POST /compounding/:id/accept — patient accepts a pharmacist quote
compoundingRouter.post(
  '/compounding/:id/accept',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await acceptQuote(req.auth!, req.params.id as string);
      res.json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  },
);

// POST /compounding/:id/decline — patient declines a pharmacist quote
compoundingRouter.post(
  '/compounding/:id/decline',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = DeclineQuoteBodySchema.parse(req.body);
      await declineQuote(req.auth!, req.params.id as string, body.note);
      res.json({ data: { success: true } });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /admin/compounding — admin list with filters
compoundingRouter.get(
  '/admin/compounding',
  ...authMiddleware,
  requirePermission('compounding.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = AdminListCompoundingQuerySchema.parse(req.query);
      const result = await listAdminCompounding(req.auth!, query);
      res.json({ data: result.rows, pagination: result.pagination });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /admin/compounding/:id — admin detail (includes internalNotes + patient info)
compoundingRouter.get(
  '/admin/compounding/:id',
  ...authMiddleware,
  requirePermission('compounding.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getAdminCompoundingDetail(req.auth!, req.params.id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /admin/compounding/:id/status — admin status update (quote, advance, decline)
compoundingRouter.patch(
  '/admin/compounding/:id/status',
  ...authMiddleware,
  requirePermission('compounding.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = AdminCompoundingStatusBodySchema.parse(req.body);
      await adminUpdateCompoundingStatus(req.auth!, req.params.id as string, body);
      res.json({ data: { success: true } });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// POST /compounding/:id/files — upload a file to a compounding request
compoundingRouter.post(
  '/compounding/:id/files',
  ...authMiddleware,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return next(new AppError('NO_FILE', 'No file uploaded', 400));
      }
      const result = await uploadCompoundingFile(req.auth!, req.params.id as string, req.file);
      res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('FILE_TOO_LARGE', 'File exceeds the maximum allowed size', 422));
      }
      next(err);
    }
  },
);

// GET /compounding/:id/files/:fileKey/url — generate a signed URL for a compounding file
compoundingRouter.get(
  '/compounding/:id/files/:fileKey/url',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fileKey = decodeURIComponent(req.params.fileKey as string);
      const result = await getCompoundingFileUrl(req.auth!, req.params.id as string, fileKey);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);
