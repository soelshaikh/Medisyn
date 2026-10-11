import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '@/core/auth/auth.middleware';
import { AppError } from '@/lib/errors';
import {
  adminListFacilities,
  adminGetFacilityById,
  adminCreateFacility,
  adminUpdateFacility,
  adminListPlans,
  adminGetPlanById,
  adminCreatePlan,
  adminUpdatePlan,
  adminListPlatformModules,
  adminSetPlanModules,
  adminGetPlatformStats,
  adminListSuperAdmins,
  adminCreateSuperAdmin,
  adminGetFacilitySeatConfig,
  adminSetFacilitySeatOverride,
  adminListFacilityStaff,
  adminCreateFacilityStaff,
} from './admin-facilities.service';

export const adminFacilitiesRouter = Router();

function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth?.isSuperAdmin) {
    return next(new AppError('FORBIDDEN', 'Platform super admin access required', 403));
  }
  next();
}

// ── Platform Stats ────────────────────────────────────────────────────────

adminFacilitiesRouter.get(
  '/admin/platform/stats',
  ...authMiddleware,
  requireSuperAdmin,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await adminGetPlatformStats();
      res.json({ data: stats });
    } catch (err) { next(err); }
  },
);

// ── Platform modules ──────────────────────────────────────────────────────

adminFacilitiesRouter.get(
  '/admin/platform/modules',
  ...authMiddleware,
  requireSuperAdmin,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const modules = await adminListPlatformModules();
      res.json({ data: modules });
    } catch (err) { next(err); }
  },
);

// ── Plans ─────────────────────────────────────────────────────────────────

adminFacilitiesRouter.get(
  '/admin/platform/plans',
  ...authMiddleware,
  requireSuperAdmin,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const plans = await adminListPlans();
      res.json({ data: plans });
    } catch (err) { next(err); }
  },
);

const CreatePlanSchema = z.object({
  key:         z.string().regex(/^[a-z0-9_]+$/, 'Key must be lowercase letters, numbers and underscores').min(2).max(50),
  name:        z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  moduleIds:   z.array(z.string().uuid()).optional(),
});

adminFacilitiesRouter.post(
  '/admin/platform/plans',
  ...authMiddleware,
  requireSuperAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = CreatePlanSchema.parse(req.body);
      const result = await adminCreatePlan(body);
      res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const msg = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        return next(new AppError('VALIDATION_ERROR', msg, 422));
      }
      if (err instanceof Error && err.message.includes('already taken')) {
        return next(new AppError('CONFLICT', err.message, 409));
      }
      next(err);
    }
  },
);

adminFacilitiesRouter.get(
  '/admin/platform/plans/:id',
  ...authMiddleware,
  requireSuperAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await adminGetPlanById((req.params['id'] as string));
      if (!plan) return next(new AppError('NOT_FOUND', 'Plan not found', 404));
      res.json({ data: plan });
    } catch (err) { next(err); }
  },
);

const UpdatePlanSchema = z.object({
  name:        z.string().min(2).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isActive:    z.boolean().optional(),
});

adminFacilitiesRouter.patch(
  '/admin/platform/plans/:id',
  ...authMiddleware,
  requireSuperAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = UpdatePlanSchema.parse(req.body);
      const existing = await adminGetPlanById((req.params['id'] as string));
      if (!existing) return next(new AppError('NOT_FOUND', 'Plan not found', 404));
      await adminUpdatePlan((req.params['id'] as string), body);
      res.json({ data: { id: req.params.id } });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const msg = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        return next(new AppError('VALIDATION_ERROR', msg, 422));
      }
      next(err);
    }
  },
);

const SetPlanModulesSchema = z.object({
  moduleIds: z.array(z.string().uuid()),
});

adminFacilitiesRouter.put(
  '/admin/platform/plans/:id/modules',
  ...authMiddleware,
  requireSuperAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { moduleIds } = SetPlanModulesSchema.parse(req.body);
      const existing = await adminGetPlanById((req.params['id'] as string));
      if (!existing) return next(new AppError('NOT_FOUND', 'Plan not found', 404));
      await adminSetPlanModules((req.params['id'] as string), moduleIds);
      res.json({ data: { id: req.params.id, moduleIds } });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const msg = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        return next(new AppError('VALIDATION_ERROR', msg, 422));
      }
      next(err);
    }
  },
);

// ── Super Admins ──────────────────────────────────────────────────────────

adminFacilitiesRouter.get(
  '/admin/platform/super-admins',
  ...authMiddleware,
  requireSuperAdmin,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await adminListSuperAdmins();
      res.json({ data: rows });
    } catch (err) { next(err); }
  },
);

const CreateSuperAdminSchema = z.object({
  email:     z.string().email(),
  password:  z.string().min(8),
  firstName: z.string().min(1).max(100),
  lastName:  z.string().min(1).max(100),
});

adminFacilitiesRouter.post(
  '/admin/platform/super-admins',
  ...authMiddleware,
  requireSuperAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = CreateSuperAdminSchema.parse(req.body);
      const result = await adminCreateSuperAdmin(body);
      res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const msg = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        return next(new AppError('VALIDATION_ERROR', msg, 422));
      }
      if (err instanceof Error && err.message.includes('already registered')) {
        return next(new AppError('CONFLICT', err.message, 409));
      }
      next(err);
    }
  },
);

// ── Facilities ────────────────────────────────────────────────────────────

const ListFacilitiesSchema = z.object({
  page:   z.coerce.number().int().positive().default(1),
  limit:  z.coerce.number().int().positive().max(100).default(25),
  search: z.string().optional(),
});

adminFacilitiesRouter.get(
  '/admin/facilities',
  ...authMiddleware,
  requireSuperAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, search } = ListFacilitiesSchema.parse(req.query);
      const { rows, total } = await adminListFacilities(page, limit, search);
      res.json({
        data: rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) { next(err); }
  },
);

adminFacilitiesRouter.get(
  '/admin/facilities/:id',
  ...authMiddleware,
  requireSuperAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facility = await adminGetFacilityById((req.params['id'] as string));
      if (!facility) return next(new AppError('NOT_FOUND', 'Facility not found', 404));
      res.json({ data: facility });
    } catch (err) { next(err); }
  },
);

const CreateFacilitySchema = z.object({
  name:   z.string().min(2).max(200),
  slug:   z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers and hyphens only').min(2).max(100),
  prefix: z.string().regex(/^[a-z]{2,8}$/, 'Prefix must be 2-8 lowercase letters only'),
  planId: z.string().uuid(),
});

adminFacilitiesRouter.post(
  '/admin/facilities',
  ...authMiddleware,
  requireSuperAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = CreateFacilitySchema.parse(req.body);
      const result = await adminCreateFacility(body);
      res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const msg = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        return next(new AppError('VALIDATION_ERROR', msg, 422));
      }
      if (err instanceof Error && (err.message.includes('already taken') || err.message.includes('already registered'))) {
        return next(new AppError('CONFLICT', err.message, 409));
      }
      next(err);
    }
  },
);

// ── Facility seat config ──────────────────────────────────────────────────

adminFacilitiesRouter.get(
  '/admin/facilities/:id/seat-config',
  ...authMiddleware,
  requireSuperAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const config = await adminGetFacilitySeatConfig((req.params['id'] as string));
      res.json({ data: config });
    } catch (err) { next(err); }
  },
);

const SetSeatOverrideSchema = z.object({
  resourceKey: z.enum(['admin_seats', 'staff_seats', 'pharmacist_seats']),
  limitValue:  z.number().int().min(-1),
});

adminFacilitiesRouter.patch(
  '/admin/facilities/:id/seat-config',
  ...authMiddleware,
  requireSuperAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = SetSeatOverrideSchema.parse(req.body);
      const superAdminId = req.auth!.userId;
      await adminSetFacilitySeatOverride(
        (req.params['id'] as string),
        body.resourceKey,
        body.limitValue,
        superAdminId,
      );
      res.json({ data: { ok: true } });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const msg = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        return next(new AppError('VALIDATION_ERROR', msg, 422));
      }
      next(err);
    }
  },
);

// ── Facility staff ────────────────────────────────────────────────────────

adminFacilitiesRouter.get(
  '/admin/facilities/:id/staff',
  ...authMiddleware,
  requireSuperAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const staff = await adminListFacilityStaff((req.params['id'] as string));
      res.json({ data: staff });
    } catch (err) { next(err); }
  },
);

const CreateFacilityStaffSchema = z.object({
  email:     z.string().email(),
  password:  z.string().min(8),
  firstName: z.string().min(1).max(100),
  lastName:  z.string().min(1).max(100),
  roleName:  z.enum(['admin', 'staff', 'pharmacist']),
});

adminFacilitiesRouter.post(
  '/admin/facilities/:id/staff',
  ...authMiddleware,
  requireSuperAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = CreateFacilityStaffSchema.parse(req.body);
      const result = await adminCreateFacilityStaff((req.params['id'] as string), body);
      res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const msg = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        return next(new AppError('VALIDATION_ERROR', msg, 422));
      }
      if (err instanceof Error && err.message.includes('already registered')) {
        return next(new AppError('CONFLICT', err.message, 409));
      }
      next(err);
    }
  },
);

const UpdateFacilitySchema = z.object({
  name:   z.string().min(2).max(200).optional(),
  status: z.enum(['active', 'suspended', 'deactivated']).optional(),
  planId: z.string().uuid().optional(),
});

adminFacilitiesRouter.patch(
  '/admin/facilities/:id',
  ...authMiddleware,
  requireSuperAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = UpdateFacilitySchema.parse(req.body);
      const existing = await adminGetFacilityById((req.params['id'] as string));
      if (!existing) return next(new AppError('NOT_FOUND', 'Facility not found', 404));
      await adminUpdateFacility((req.params['id'] as string), {
        name:   body.name,
        status: body.status,
        planId: body.planId,
      });
      res.json({ data: { id: req.params.id, ...body } });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const msg = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        return next(new AppError('VALIDATION_ERROR', msg, 422));
      }
      next(err);
    }
  },
);
