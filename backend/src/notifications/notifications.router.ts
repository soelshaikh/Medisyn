import { Router, Request, Response, NextFunction } from 'express';
import { eq, and } from 'drizzle-orm';
import { authMiddleware, requirePermission } from '@/core/auth/auth.middleware';
import { AppError } from '@/lib/errors';
import { workerDb } from '@/db';
import { facilityUsers, facilityRoles } from '@/db/schema/rbac';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  softDeleteNotification,
  broadcastNotifications,
} from './notifications.service';
import {
  ListNotificationsQuerySchema,
  NotificationParamsSchema,
  BroadcastNotificationBodySchema,
} from './notifications.validator';
import type { AuthContext } from '@/core/auth/middleware/parse-jwt';

export const notificationsRouter = Router();

// ── GET /api/v1/notifications ─────────────────────────────────────────────────

notificationsRouter.get(
  '/notifications',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as Request & { auth: AuthContext }).auth;
    const parsed = ListNotificationsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      return next(new AppError('VALIDATION_ERROR', msg, 422));
    }

    if (!auth.facilityId) {
      // Super admin has no facility context — return empty notifications
      if (auth.isSuperAdmin) {
        return res.json({
          success: true,
          data: { items: [], unreadCount: 0, pagination: { page: 1, limit: parsed.data.limit, total: 0 } },
        });
      }
      return next(new AppError('FORBIDDEN', 'Facility context required', 403));
    }

    try {
      const result = await listNotifications(auth.userId, auth.facilityId, parsed.data);
      return res.json({
        success: true,
        data: {
          items: result.items,
          unreadCount: result.unreadCount,
          pagination: {
            page: parsed.data.page,
            limit: parsed.data.limit,
            total: result.total,
            totalPages: Math.ceil(result.total / parsed.data.limit),
          },
        },
      });
    } catch (err) {
      return next(err);
    }
  },
);

// ── PATCH /api/v1/notifications/:id/read ─────────────────────────────────────

notificationsRouter.patch(
  '/notifications/:id/read',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as Request & { auth: AuthContext }).auth;
    const parsed = NotificationParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return next(new AppError('VALIDATION_ERROR', 'Invalid notification ID', 422));
    }

    if (!auth.facilityId) {
      return next(new AppError('FORBIDDEN', 'Facility context required', 403));
    }

    try {
      await markNotificationRead(parsed.data.id, auth.userId, auth.facilityId);
      return res.json({ success: true });
    } catch (err) {
      return next(err);
    }
  },
);

// ── POST /api/v1/notifications/read-all ──────────────────────────────────────

notificationsRouter.post(
  '/notifications/read-all',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as Request & { auth: AuthContext }).auth;

    if (!auth.facilityId) {
      return next(new AppError('FORBIDDEN', 'Facility context required', 403));
    }

    try {
      await markAllNotificationsRead(auth.userId, auth.facilityId);
      return res.json({ success: true });
    } catch (err) {
      return next(err);
    }
  },
);

// ── DELETE /api/v1/notifications/:id ─────────────────────────────────────────

notificationsRouter.delete(
  '/notifications/:id',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as Request & { auth: AuthContext }).auth;
    const parsed = NotificationParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return next(new AppError('VALIDATION_ERROR', 'Invalid notification ID', 422));
    }

    if (!auth.facilityId) {
      return next(new AppError('FORBIDDEN', 'Facility context required', 403));
    }

    try {
      const deleted = await softDeleteNotification(parsed.data.id, auth.userId, auth.facilityId);
      if (!deleted) {
        return next(new AppError('NOT_FOUND', 'Notification not found', 404));
      }
      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  },
);

// ── POST /api/v1/admin/notifications/broadcast ────────────────────────────────

notificationsRouter.post(
  '/admin/notifications/broadcast',
  ...authMiddleware,
  requirePermission('notifications.broadcast'),
  async (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as Request & { auth: AuthContext }).auth;
    const parsed = BroadcastNotificationBodySchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      return next(new AppError('VALIDATION_ERROR', msg, 422));
    }

    if (!auth.facilityId) {
      return next(new AppError('FORBIDDEN', 'Facility context required', 403));
    }

    try {
      let targetUserIds: string[];

      if (parsed.data.userIds && parsed.data.userIds.length > 0) {
        targetUserIds = parsed.data.userIds;
      } else {
        // Broadcast to all active patients in the facility
        const patientRole = await workerDb
          .select({ id: facilityRoles.id })
          .from(facilityRoles)
          .where(and(eq(facilityRoles.facilityId, auth.facilityId), eq(facilityRoles.name, 'patient')))
          .limit(1);

        if (!patientRole.length) {
          return res.json({ success: true, data: { sent: 0 } });
        }

        const patients = await workerDb
          .select({ userId: facilityUsers.userId })
          .from(facilityUsers)
          .where(
            and(
              eq(facilityUsers.facilityId, auth.facilityId),
              eq(facilityUsers.roleId, patientRole[0].id),
              eq(facilityUsers.isActive, true),
            ),
          );

        targetUserIds = patients.map((p) => p.userId);
      }

      const sent = await broadcastNotifications(auth.facilityId, targetUserIds, {
        type: 'broadcast',
        title: parsed.data.title,
        body: parsed.data.body,
        actionUrl: parsed.data.actionUrl,
      });

      return res.json({ success: true, data: { sent } });
    } catch (err) {
      return next(err);
    }
  },
);
