import rateLimit from 'express-rate-limit';

/** 200 requests per minute per IP — applied to all /api/v1 routes */
export const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later.' } },
});

/** 5 requests per minute per IP — auth endpoints (login, register, forgot/reset/verify) */
export const authStrictLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later.' } },
});

/** 10 requests per minute per IP — healthcare submission endpoints */
export const healthcareLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later.' } },
});
