import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "@/common/utils/logger";

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
    public details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  /* Zod validation errors */
  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {};
    err.errors.forEach((e) => {
      const key = e.path.join(".");
      details[key] = [...(details[key] ?? []), e.message];
    });
    return res.status(422).json({
      success: false,
      error: "Validation failed",
      statusCode: 422,
      details,
    });
  }

  /* Known app errors */
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      statusCode: err.statusCode,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  /* Unknown errors */
  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    requestId: req.requestId,
    path: req.path,
  });

  return res.status(500).json({
    success: false,
    error: "Internal server error",
    statusCode: 500,
  });
}
