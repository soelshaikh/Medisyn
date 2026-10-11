import { Router } from 'express';
import { authMiddleware } from '@/core/auth/auth.middleware';
import { requirePermission } from '@/core/auth/middleware/require-permission';
import { AppError } from '@/lib/errors';
import {
  adminListUsers,
  adminSearchUsers,
  adminGetUserById,
  adminSetUserStatus,
  adminSetUserRoles,
} from './admin-users.service';

export const adminUsersRouter = Router();

// GET /users/search?q=...  (must be before /users/:id)
adminUsersRouter.get(
  '/users/search',
  ...authMiddleware,
  requirePermission('users.read'),
  async (req, res, next) => {
    try {
      const { facilityId } = req.auth!;
      if (!facilityId) return next(new AppError('FORBIDDEN', 'No facility context', 403));
      const q = String(req.query.q ?? '').trim();
      if (!q) return res.json({ data: [] });
      const results = await adminSearchUsers(facilityId, q);
      return res.json({ data: results });
    } catch (err) {
      return next(err);
    }
  },
);

// GET /users
adminUsersRouter.get(
  '/users',
  ...authMiddleware,
  requirePermission('users.read'),
  async (req, res, next) => {
    try {
      const { facilityId } = req.auth!;
      if (!facilityId) return next(new AppError('FORBIDDEN', 'No facility context', 403));
      const result = await adminListUsers(facilityId, req.query as Record<string, string>);
      return res.json({ data: result.data, pagination: result.pagination });
    } catch (err) {
      return next(err);
    }
  },
);

// GET /users/:id
adminUsersRouter.get(
  '/users/:id',
  ...authMiddleware,
  requirePermission('users.read'),
  async (req, res, next) => {
    try {
      const { facilityId } = req.auth!;
      if (!facilityId) return next(new AppError('FORBIDDEN', 'No facility context', 403));
      const user = await adminGetUserById(facilityId, req.params.id as string);
      if (!user) return next(new AppError('NOT_FOUND', 'User not found', 404));
      return res.json({ data: user });
    } catch (err) {
      return next(err);
    }
  },
);

// PATCH /users/:id/status
adminUsersRouter.patch(
  '/users/:id/status',
  ...authMiddleware,
  requirePermission('users.manage'),
  async (req, res, next) => {
    try {
      const { facilityId, userId } = req.auth!;
      if (!facilityId) return next(new AppError('FORBIDDEN', 'No facility context', 403));
      const { status } = req.body as { status: string };
      if (!status) return next(new AppError('VALIDATION_ERROR', 'status is required', 422));

      await adminSetUserStatus(userId, facilityId, req.params.id as string, status, req.ip, req.headers['user-agent']);
      const updated = await adminGetUserById(facilityId, req.params.id as string);
      return res.json({ data: updated });
    } catch (err) {
      return next(err);
    }
  },
);

// PATCH /users/:id/roles
adminUsersRouter.patch(
  '/users/:id/roles',
  ...authMiddleware,
  requirePermission('users.manage'),
  async (req, res, next) => {
    try {
      const { facilityId, userId } = req.auth!;
      if (!facilityId) return next(new AppError('FORBIDDEN', 'No facility context', 403));
      const { roleIds } = req.body as { roleIds: string[] };
      if (!Array.isArray(roleIds) || roleIds.length === 0) {
        return next(new AppError('VALIDATION_ERROR', 'roleIds must be a non-empty array', 422));
      }

      await adminSetUserRoles(userId, facilityId, req.params.id as string, roleIds, req.ip, req.headers['user-agent']);
      const updated = await adminGetUserById(facilityId, req.params.id as string);
      return res.json({ data: updated });
    } catch (err) {
      return next(err);
    }
  },
);
