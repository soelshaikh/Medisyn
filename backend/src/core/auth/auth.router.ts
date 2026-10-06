import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { authMiddleware } from '@/app';
import { authService } from './auth.service';
import {
  RegisterBodySchema,
  LoginBodySchema,
  ForgotPasswordBodySchema,
  ResetPasswordBodySchema,
  VerifyEmailBodySchema,
  ResendVerificationBodySchema,
} from './auth.validator';
import { AppError } from '@/lib/errors';

export const authRouter = Router();

const COOKIE_NAME = 'refresh_token';
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/v1/auth',
    maxAge: COOKIE_MAX_AGE_MS,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/api/v1/auth' });
}

function zodError(err: ZodError): AppError {
  const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
  return new AppError('VALIDATION_ERROR', message, 422);
}

// ── POST /register ─────────────────────────────────────────────────────────
authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  const parsed = RegisterBodySchema.safeParse(req.body);
  if (!parsed.success) return next(zodError(parsed.error));

  try {
    const result = await authService.register(
      parsed.data,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
    return res.status(201).json({
      data: {
        message: 'Registration successful. Please check your email to verify your account.',
        userId: result.userId,
      },
    });
  } catch (err) {
    return next(err);
  }
});

// ── POST /login ────────────────────────────────────────────────────────────
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  const parsed = LoginBodySchema.safeParse(req.body);
  if (!parsed.success) return next(zodError(parsed.error));

  try {
    const result = await authService.login(
      parsed.data,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
    setRefreshCookie(res, result.rawRefreshToken);
    return res.status(200).json({ data: { accessToken: result.accessToken, user: result.user } });
  } catch (err) {
    return next(err);
  }
});

// ── POST /refresh ──────────────────────────────────────────────────────────
authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  const cookieToken: string | undefined = (req.cookies as Record<string, string>)[COOKIE_NAME];
  const authHeader: string | undefined = req.headers.authorization?.slice(7);

  try {
    const result = await authService.refreshToken(
      authHeader,
      cookieToken,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
    setRefreshCookie(res, result.rawRefreshToken);
    return res.status(200).json({ data: { accessToken: result.accessToken } });
  } catch (err) {
    return next(err);
  }
});

// ── POST /logout ───────────────────────────────────────────────────────────
authRouter.post(
  '/logout',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.logout(
        req.auth!.sessionId,
        req.auth!.userId,
        req.auth!.facilityId,
        req.ip ?? '',
        req.headers['user-agent'] ?? '',
      );
      clearRefreshCookie(res);
      return res.status(200).json({ data: { message: 'Logged out successfully.' } });
    } catch (err) {
      return next(err);
    }
  },
);

// ── POST /logout-all ───────────────────────────────────────────────────────
authRouter.post(
  '/logout-all',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.logoutAll(
        req.auth!.userId,
        req.auth!.facilityId,
        req.ip ?? '',
        req.headers['user-agent'] ?? '',
      );
      clearRefreshCookie(res);
      return res.status(200).json({ data: { message: 'All sessions terminated.' } });
    } catch (err) {
      return next(err);
    }
  },
);

// ── POST /forgot-password ──────────────────────────────────────────────────
authRouter.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
  const parsed = ForgotPasswordBodySchema.safeParse(req.body);
  if (!parsed.success) return next(zodError(parsed.error));

  try {
    await authService.forgotPassword(
      parsed.data,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
    return res.status(200).json({
      data: { message: 'If that email address is registered, you will receive a reset link shortly.' },
    });
  } catch (err) {
    return next(err);
  }
});

// ── POST /reset-password ───────────────────────────────────────────────────
authRouter.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  const parsed = ResetPasswordBodySchema.safeParse(req.body);
  if (!parsed.success) return next(zodError(parsed.error));

  try {
    await authService.resetPassword(
      parsed.data,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
    return res.status(200).json({
      data: { message: 'Password updated. Please log in with your new password.' },
    });
  } catch (err) {
    return next(err);
  }
});

// ── POST /verify-email ─────────────────────────────────────────────────────
authRouter.post('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
  const parsed = VerifyEmailBodySchema.safeParse(req.body);
  if (!parsed.success) return next(zodError(parsed.error));

  try {
    await authService.verifyEmail(parsed.data);
    return res.status(200).json({ data: { message: 'Email verified successfully.' } });
  } catch (err) {
    return next(err);
  }
});

// ── POST /resend-verification ──────────────────────────────────────────────
authRouter.post('/resend-verification', async (req: Request, res: Response, next: NextFunction) => {
  const parsed = ResendVerificationBodySchema.safeParse(req.body);
  if (!parsed.success) return next(zodError(parsed.error));

  try {
    await authService.resendVerification(
      parsed.data,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
    return res.status(200).json({
      data: { message: "If that email has an unverified account, a new verification link has been sent." },
    });
  } catch (err) {
    return next(err);
  }
});
