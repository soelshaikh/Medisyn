import rateLimit from "express-rate-limit";
import type { Request } from "express";

const IS_DEV = process.env.NODE_ENV !== "production";

const json429 = (message: string) => ({
  success: false, error: message, statusCode: 429,
});

// In development, skip all rate limiting so testing isn't blocked by limits
const skipInDev = (_req: Request) => IS_DEV;

/** 200 req / 15 min — all authenticated API consumers (unlimited in dev) */
export const globalApiLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             200,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         json429("Too many requests — please slow down"),
  skip: (req)      => IS_DEV || req.path === "/health",
});

/** 30 req / min — write operations on ecommerce (unlimited in dev) */
export const ecommerceMutationLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             30,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         json429("Too many requests — please try again shortly"),
  skip:            skipInDev,
});

/** 20 submissions / hour — healthcare workflow submissions (unlimited in dev) */
export const healthcareSubmitLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         json429("Too many submission requests — please try again later"),
  skip:            skipInDev,
});

/** 10 uploads / hour — file uploads (unlimited in dev) */
export const uploadLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         json429("Upload limit reached — please try again later"),
  skip:            skipInDev,
});
