import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from './lib/errors';
import { authRouter } from './core/auth/auth.router';

// Auth middleware chain — Steps 2–7 are stubs until Phase 2 implementation
import { parseJWT } from './core/auth/middleware/parse-jwt';
import { checkSession } from './core/auth/middleware/check-session';
import { verifyAuthVersion } from './core/auth/middleware/verify-auth-version';
import { checkFacilityStatus } from './core/auth/middleware/check-facility-status';
import { requireModule } from './core/auth/middleware/require-module';
import { requirePermission } from './core/auth/middleware/require-permission';

export const authMiddleware = [
  parseJWT,
  checkSession,
  verifyAuthVersion,
  checkFacilityStatus,
];

export { requireModule, requirePermission };

export function createApp() {
  const app = express();

  // ── Security headers ─────────────────────────────────────────────────
  app.use(helmet());
  app.use(
    cors({
      origin: [
        process.env.FRONTEND_URL ?? 'http://localhost:3000',
        process.env.ADMIN_URL ?? 'http://localhost:3002',
      ],
      credentials: true,
    }),
  );

  // ── Parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // ── Request ID ───────────────────────────────────────────────────────
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { id: string }).id = uuidv4();
    next();
  });

  // ── Global rate limit ────────────────────────────────────────────────
  app.use(
    '/api/v1',
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 min
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // ── Auth routes ───────────────────────────────────────────────────────
  app.use('/api/v1/auth', authRouter);

  // ── Health (no auth) ─────────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── Ping (auth chain smoke test) ─────────────────────────────────────
  app.get(
    '/api/v1/ping',
    ...authMiddleware,
    (req: Request, res: Response) => {
      const auth = (req as Request & { auth?: Record<string, unknown> }).auth;
      res.json({ userId: auth?.userId, facilityId: auth?.facilityId });
    },
  );

  // ── 404 ───────────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  // ── Global error handler ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const reqId = (req as Request & { id?: string }).id;

    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
          requestId: reqId,
        },
      });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error(err);
    }

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        requestId: reqId,
      },
    });
  });

  return app;
}
