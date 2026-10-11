import { Router } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { superAdminDb } from '@/db';
import { auditLog } from '@/db/schema/audit';
import { users } from '@/db/schema/core';
import { authMiddleware } from '@/core/auth/auth.middleware';
import { requirePermission } from '@/core/auth/middleware/require-permission';
import { AppError } from '@/lib/errors';

export const adminAuditRouter = Router();

// GET /admin/audit
adminAuditRouter.get(
  '/admin/audit',
  ...authMiddleware,
  requirePermission('audit.read'),
  async (req, res, next) => {
    try {
      const { facilityId } = req.auth!;
      if (!facilityId) return next(new AppError('FORBIDDEN', 'No facility context', 403));

      const page  = Math.max(1, Number(req.query.page)  || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;

      const [rows, [countRow]] = await Promise.all([
        superAdminDb
          .select({
            id:           auditLog.id,
            actorId:      auditLog.actorId,
            actorEmail:   users.email,
            action:       auditLog.action,
            resourceType: auditLog.resourceType,
            resourceId:   auditLog.resourceId,
            metadata:     auditLog.metadata,
            ipAddress:    auditLog.ipAddress,
            createdAt:    auditLog.createdAt,
          })
          .from(auditLog)
          .leftJoin(users, eq(users.id, auditLog.actorId))
          .where(eq(auditLog.facilityId, facilityId))
          .orderBy(desc(auditLog.createdAt))
          .limit(limit)
          .offset(offset),

        superAdminDb
          .select({ total: sql<number>`count(*)::int` })
          .from(auditLog)
          .where(eq(auditLog.facilityId, facilityId)),
      ]);

      const total = Number(countRow?.total ?? 0);

      return res.json({
        data: rows.map((r) => ({
          id:         String(r.id),
          userId:     r.actorId ?? null,
          userEmail:  r.actorEmail ?? '',
          action:     r.action,
          resource:   r.resourceType ?? '',
          resourceId: r.resourceId ?? '',
          details:    (r.metadata as Record<string, unknown>) ?? {},
          ipAddress:  r.ipAddress ?? '',
          createdAt:  r.createdAt.toISOString(),
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      return next(err);
    }
  },
);
