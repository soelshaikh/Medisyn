import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, requirePermission } from '@/core/auth/auth.middleware';
import { AppError } from '@/lib/errors';
import { enqueueEmail } from './email.queue';
import { findEmailLogById, listEmailLog, updateEmailLogStatus } from './email-log.service';
import {
  ListEmailLogQuerySchema,
  RetryEmailLogParamsSchema,
} from './email-log.validator';
import type { AuthContext } from '@/core/auth/middleware/parse-jwt';

export const emailLogRouter = Router();

// ── GET / — list email log entries ────────────────────────────────────────

emailLogRouter.get(
  '/',
  ...authMiddleware,
  requirePermission('email_log.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as Request & { auth: AuthContext }).auth;
    const parsed = ListEmailLogQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      return next(new AppError('VALIDATION_ERROR', msg, 422));
    }

    const { page, limit, status, recipient, template, from, to } = parsed.data;

    try {
      const { items, total } = await listEmailLog(
        auth.facilityId!,
        { status, recipient, template, from, to },
        { page, limit },
      );

      return res.json({
        success: true,
        data: {
          items,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (err) {
      return next(err);
    }
  },
);

// ── POST /:id/retry — re-enqueue a failed email job ───────────────────────

emailLogRouter.post(
  '/:id/retry',
  ...authMiddleware,
  requirePermission('email_log.retry'),
  async (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as Request & { auth: AuthContext }).auth;
    const parsed = RetryEmailLogParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return next(new AppError('VALIDATION_ERROR', 'Invalid log entry ID', 422));
    }

    try {
      const log = await findEmailLogById(auth.facilityId!, parsed.data.id);
      if (!log) {
        return next(new AppError('NOT_FOUND', 'Email log entry not found', 404));
      }
      if (log.status !== 'failed' && log.status !== 'bounced') {
        return next(
          new AppError('VALIDATION_ERROR', `Cannot retry a job with status '${log.status}'`, 400),
        );
      }

      const retryIdempotencyKey = `${log.idempotencyKey}-retry-${Date.now()}`;

      // Reset log entry to queued
      await updateEmailLogStatus(log.id, {
        status: 'queued',
        errorMessage: null,
        attemptCount: 0,
        jobId: retryIdempotencyKey,
      });

      // Re-enqueue (the payload for templateData is not stored in log — use minimal re-send)
      await enqueueEmail({
        to: log.recipient,
        templateName: log.templateName,
        templateData: {},
        idempotencyKey: retryIdempotencyKey,
        facilityId: log.facilityId ?? null,
      });

      return res.json({
        success: true,
        data: {
          id: log.id,
          status: 'queued',
          jobId: retryIdempotencyKey,
          enqueuedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      return next(err);
    }
  },
);
