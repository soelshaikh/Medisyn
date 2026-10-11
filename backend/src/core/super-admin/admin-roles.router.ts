import { Router } from 'express';
import { authMiddleware } from '@/core/auth/auth.middleware';
import { requirePermission } from '@/core/auth/middleware/require-permission';
import { AppError } from '@/lib/errors';
import {
  adminListRoles,
  adminGetRoleById,
  adminCreateRole,
  adminUpdateRole,
  adminDeleteRole,
  adminSetRolePermissions,
} from './admin-roles.service';

export const adminRolesRouter = Router();

// GET /admin/roles
adminRolesRouter.get(
  '/admin/roles',
  ...authMiddleware,
  requirePermission('roles.read'),
  async (req, res, next) => {
    try {
      const { facilityId } = req.auth!;
      if (!facilityId) return next(new AppError('FORBIDDEN', 'No facility context', 403));
      const roles = await adminListRoles(facilityId);
      return res.json({ data: roles });
    } catch (err) {
      return next(err);
    }
  },
);

// POST /admin/roles
adminRolesRouter.post(
  '/admin/roles',
  ...authMiddleware,
  requirePermission('roles.manage'),
  async (req, res, next) => {
    try {
      const { facilityId, userId } = req.auth!;
      if (!facilityId) return next(new AppError('FORBIDDEN', 'No facility context', 403));
      const { name } = req.body as { name: string; slug?: string; description?: string };
      if (!name || typeof name !== 'string') {
        return next(new AppError('VALIDATION_ERROR', 'name is required', 422));
      }
      const role = await adminCreateRole(userId, facilityId, name.trim(), req.ip, req.headers['user-agent']);
      return res.status(201).json({ data: role });
    } catch (err) {
      return next(err);
    }
  },
);

// GET /admin/roles/:id
adminRolesRouter.get(
  '/admin/roles/:id',
  ...authMiddleware,
  requirePermission('roles.read'),
  async (req, res, next) => {
    try {
      const { facilityId } = req.auth!;
      if (!facilityId) return next(new AppError('FORBIDDEN', 'No facility context', 403));
      const role = await adminGetRoleById(facilityId, req.params.id as string);
      if (!role) return next(new AppError('NOT_FOUND', 'Role not found', 404));
      return res.json({ data: role });
    } catch (err) {
      return next(err);
    }
  },
);

// PATCH /admin/roles/:id
adminRolesRouter.patch(
  '/admin/roles/:id',
  ...authMiddleware,
  requirePermission('roles.manage'),
  async (req, res, next) => {
    try {
      const { facilityId, userId } = req.auth!;
      if (!facilityId) return next(new AppError('FORBIDDEN', 'No facility context', 403));
      const { name } = req.body as { name?: string; description?: string };
      if (!name || typeof name !== 'string') {
        return next(new AppError('VALIDATION_ERROR', 'name is required', 422));
      }
      const role = await adminUpdateRole(userId, facilityId, req.params.id as string, name.trim(), req.ip, req.headers['user-agent']);
      return res.json({ data: role });
    } catch (err) {
      return next(err);
    }
  },
);

// DELETE /admin/roles/:id
adminRolesRouter.delete(
  '/admin/roles/:id',
  ...authMiddleware,
  requirePermission('roles.manage'),
  async (req, res, next) => {
    try {
      const { facilityId, userId } = req.auth!;
      if (!facilityId) return next(new AppError('FORBIDDEN', 'No facility context', 403));
      await adminDeleteRole(userId, facilityId, req.params.id as string, req.ip, req.headers['user-agent']);
      return res.json({ data: { success: true } });
    } catch (err) {
      return next(err);
    }
  },
);

// PUT /admin/roles/:id/permissions
adminRolesRouter.put(
  '/admin/roles/:id/permissions',
  ...authMiddleware,
  requirePermission('roles.manage'),
  async (req, res, next) => {
    try {
      const { facilityId, userId } = req.auth!;
      if (!facilityId) return next(new AppError('FORBIDDEN', 'No facility context', 403));
      const { permissions } = req.body as { permissions: string[] };
      if (!Array.isArray(permissions)) {
        return next(new AppError('VALIDATION_ERROR', 'permissions must be an array', 422));
      }
      await adminSetRolePermissions(userId, facilityId, req.params.id as string, permissions, req.ip, req.headers['user-agent']);
      const role = await adminGetRoleById(facilityId, req.params.id as string);
      return res.json({ data: role });
    } catch (err) {
      return next(err);
    }
  },
);
