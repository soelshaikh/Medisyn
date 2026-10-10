import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { authMiddleware } from '@/core/auth/auth.middleware';
import { requirePermission } from '@/core/auth/middleware/require-permission';
import { resolveFacility } from '@/middleware/resolve-facility';
import { AppError } from '@/lib/errors';
import {
  listPublicCatalog,
  listAdminCatalog,
  createCatalogEntry,
  updateCatalogEntryService,
  submitAssessment,
  listPatientAssessments,
  getPatientAssessmentDetail,
  listAdminAssessments,
  getAdminAssessmentDetail,
  updateAssessmentStatus,
} from './minor-ailment.service';
import {
  CreateAssessmentBodySchema,
  ListAssessmentsQuerySchema,
  AdminListAssessmentsQuerySchema,
  CreateCatalogEntryBodySchema,
  UpdateCatalogEntryBodySchema,
  AdminAssessmentStatusBodySchema,
} from './minor-ailment.validator';

export const minorAilmentRouter = Router();

function zodError(err: ZodError): AppError {
  const msg = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
  return new AppError('VALIDATION_ERROR', msg, 422);
}

// GET /minor-ailments/catalog — public, no auth required
minorAilmentRouter.get(
  '/minor-ailments/catalog',
  resolveFacility,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = res.locals.facilityId as string;
      const catalog = await listPublicCatalog(facilityId);
      res.json({ data: catalog });
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/minor-ailments/catalog — admin all (including inactive)
minorAilmentRouter.get(
  '/admin/minor-ailments/catalog',
  ...authMiddleware,
  requirePermission('minor-ailments.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const catalog = await listAdminCatalog(req.auth!);
      res.json({ data: catalog });
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/minor-ailments/catalog — create ailment entry
minorAilmentRouter.post(
  '/admin/minor-ailments/catalog',
  ...authMiddleware,
  requirePermission('minor-ailments.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = CreateCatalogEntryBodySchema.parse(req.body);
      const entry = await createCatalogEntry(req.auth!, body);
      res.status(201).json({ data: entry });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// PATCH /admin/minor-ailments/catalog/:id — update ailment entry
minorAilmentRouter.patch(
  '/admin/minor-ailments/catalog/:id',
  ...authMiddleware,
  requirePermission('minor-ailments.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = UpdateCatalogEntryBodySchema.parse(req.body);
      const entry = await updateCatalogEntryService(req.auth!, req.params.id as string, body);
      res.json({ data: entry });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// POST /minor-ailments/assessments — patient submits assessment
minorAilmentRouter.post(
  '/minor-ailments/assessments',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = CreateAssessmentBodySchema.parse(req.body);
      const result = await submitAssessment(req.auth!, body);
      res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /minor-ailments/assessments — list patient's own assessments
minorAilmentRouter.get(
  '/minor-ailments/assessments',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = ListAssessmentsQuerySchema.parse(req.query);
      const result = await listPatientAssessments(req.auth!, query);
      res.json({ data: result.rows, pagination: result.pagination });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /minor-ailments/assessments/:id — patient assessment detail (no internalNotes)
minorAilmentRouter.get(
  '/minor-ailments/assessments/:id',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getPatientAssessmentDetail(req.auth!, req.params.id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/minor-ailments/assessments — admin list with filters
minorAilmentRouter.get(
  '/admin/minor-ailments/assessments',
  ...authMiddleware,
  requirePermission('minor-ailments.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = AdminListAssessmentsQuerySchema.parse(req.query);
      const result = await listAdminAssessments(req.auth!, query);
      res.json({ data: result.rows, pagination: result.pagination });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// GET /admin/minor-ailments/assessments/:id — admin detail (internalNotes + patient info)
minorAilmentRouter.get(
  '/admin/minor-ailments/assessments/:id',
  ...authMiddleware,
  requirePermission('minor-ailments.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getAdminAssessmentDetail(req.auth!, req.params.id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /admin/minor-ailments/assessments/:id/status — admin treat or refer
minorAilmentRouter.patch(
  '/admin/minor-ailments/assessments/:id/status',
  ...authMiddleware,
  requirePermission('minor-ailments.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = AdminAssessmentStatusBodySchema.parse(req.body);
      await updateAssessmentStatus(req.auth!, req.params.id as string, body);
      res.json({ data: { success: true } });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);
