import { Router } from 'express';
import { authMiddleware } from '@/core/auth/auth.middleware';
import { requirePermission } from '@/core/auth/middleware/require-permission';
import { AppError } from '@/lib/errors';
import { adminListPermissions } from './admin-roles.service';

export const adminPermissionsRouter = Router();

// GET /admin/permissions
adminPermissionsRouter.get(
  '/admin/permissions',
  ...authMiddleware,
  requirePermission('roles.read'),
  async (req, res, next) => {
    try {
      const { facilityId } = req.auth!;
      if (!facilityId) return next(new AppError('FORBIDDEN', 'No facility context', 403));
      const perms = await adminListPermissions();
      return res.json({ data: perms });
    } catch (err) {
      return next(err);
    }
  },
);
