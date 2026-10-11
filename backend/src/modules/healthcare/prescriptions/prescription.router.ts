import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
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
  uploadPrescriptionFile,
  getPrescriptionFileUrl,
} from './prescription.service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.FILE_MAX_SIZE_BYTES ?? 10_485_760) },
});
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

/**
 * @openapi
 * /prescriptions:
 *   post:
 *     tags: [Healthcare]
 *     summary: Submit a prescription request
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, medicationName]
 *             properties:
 *               type: { type: string, enum: [refill, transfer, new] }
 *               medicationName: { type: string, maxLength: 200 }
 *               dosage: { type: string, maxLength: 100 }
 *               prescriberName: { type: string, maxLength: 200 }
 *               prescriberFax: { type: string, maxLength: 30 }
 *     responses:
 *       201:
 *         description: Prescription request submitted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     status: { type: string, enum: [submitted] }
 *                     createdAt: { type: string, format: date-time }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *   get:
 *     tags: [Healthcare]
 *     summary: List patient's own prescription requests
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [submitted, under_review, approved, declined] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated list of prescription requests
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
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

// POST /prescriptions/:id/files — upload a file to a prescription request
prescriptionRouter.post(
  '/prescriptions/:id/files',
  ...authMiddleware,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return next(new AppError('NO_FILE', 'No file uploaded', 400));
      }
      const result = await uploadPrescriptionFile(req.auth!, req.params.id as string, req.file);
      res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('FILE_TOO_LARGE', 'File exceeds the maximum allowed size', 422));
      }
      next(err);
    }
  },
);

// GET /prescriptions/:id/files/:fileKey/url — generate a signed URL for a prescription file
prescriptionRouter.get(
  '/prescriptions/:id/files/:fileKey/url',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fileKey = decodeURIComponent(req.params.fileKey as string);
      const result = await getPrescriptionFileUrl(req.auth!, req.params.id as string, fileKey);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);
