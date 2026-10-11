import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from './lib/errors';
import { globalLimiter, authStrictLimiter, healthcareLimiter } from './middleware/rate-limit';
import { authRouter } from './core/auth/auth.router';
import { authMiddleware, requireModule, requirePermission } from './core/auth/auth.middleware';
import { catalogueRouter } from './modules/catalogue/catalogue.router';
import { commerceRouter } from './modules/commerce.router';
import { healthcareRouter } from './modules/healthcare/healthcare.router';
import { appointmentsRouter } from './modules/appointments/appointments.router';
import { emailLogRouter } from './email/email-log.router';
import { notificationsRouter } from './notifications/notifications.router';
import { reportsRouter } from './modules/reports/reports.router';
import { swaggerRouter } from './lib/swagger/swagger.router';
import { adminUsersRouter } from './core/super-admin/admin-users.router';
import { adminRolesRouter } from './core/super-admin/admin-roles.router';
import { adminPermissionsRouter } from './core/super-admin/admin-permissions.router';
import { adminAuditRouter } from './core/super-admin/admin-audit.router';
import { adminFacilitiesRouter } from './core/super-admin/admin-facilities.router';

export { authMiddleware, requireModule, requirePermission };

function parseAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS;
  if (raw) {
    return raw.split(',').map((o) => o.trim()).filter(Boolean);
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ALLOWED_ORIGINS environment variable is required in production');
  }
  // Dev / test fallback
  return [
    process.env.FRONTEND_URL ?? 'http://localhost:3000',
    process.env.ADMIN_URL ?? 'http://localhost:3002',
  ];
}

export function createApp() {
  const app = express();

  const allowedOrigins = parseAllowedOrigins();

  // ── CORS (MUST be before Helmet so OPTIONS preflight gets the right headers) ──
  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Facility-ID'],
    optionsSuccessStatus: 204,
  };

  app.use(cors(corsOptions));
  // Explicitly handle OPTIONS preflight for every route
  app.options('*', cors(corsOptions));

  // ── Swagger UI (BEFORE global Helmet — needs relaxed CSP for inline scripts) ──
  app.use('/api/docs', helmet({ contentSecurityPolicy: false }), swaggerRouter);

  // ── Security headers (all other routes) ─────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          scriptSrc: ["'none'"],
          styleSrc: ["'none'"],
          imgSrc: ["'none'"],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
          formAction: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31_536_000,
        includeSubDomains: true,
        preload: true,
      },
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xContentTypeOptions: true,
      xXssProtection: false,
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

  // ── Global rate limit (200/min per IP) ──────────────────────────────
  app.use('/api/v1', globalLimiter);

  // ── Auth routes (strict 5/min rate limit) ────────────────────────────
  app.use('/api/v1/auth', authStrictLimiter, authRouter);

  // ── Catalogue routes ──────────────────────────────────────────────────
  app.use('/api/v1/catalogue', catalogueRouter);

  // ── Commerce routes (cart, shipping, checkout, orders) ───────────────
  app.use('/api/v1', commerceRouter);

  // ── Healthcare routes — submission endpoints get stricter limit ───────
  app.post('/api/v1/prescriptions', healthcareLimiter);
  app.post('/api/v1/compounding', healthcareLimiter);
  app.post('/api/v1/ask-pharmacist', healthcareLimiter);
  app.use('/api/v1', healthcareRouter);

  // ── Appointments routes ───────────────────────────────────────────────
  app.use('/api/v1', appointmentsRouter);

  // ── Phase 7 — Async Email ─────────────────────────────────────────────
  app.use('/api/v1/admin/email-log', emailLogRouter);

  // ── Phase 7 — Notifications ──────────────────────────────────────────
  app.use('/api/v1', notificationsRouter);

  // ── Phase 8 — Admin Reports & Dashboard ──────────────────────────────
  app.use('/api/v1/admin/reports', reportsRouter);

  // ── Phase 12 — Admin Panel: Users, Roles, Permissions, Audit ─────────
  app.use('/api/v1', adminUsersRouter);
  app.use('/api/v1', adminRolesRouter);
  app.use('/api/v1', adminPermissionsRouter);
  app.use('/api/v1', adminAuditRouter);
  app.use('/api/v1', adminFacilitiesRouter);

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

    // Body too large (express body-parser throws this)
    if (
      typeof err === 'object' &&
      err !== null &&
      'type' in err &&
      (err as { type: string }).type === 'entity.too.large'
    ) {
      return res.status(413).json({
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large.', requestId: reqId },
      });
    }

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
