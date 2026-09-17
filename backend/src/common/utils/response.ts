import type { Response } from "express";

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = "Success",
  statusCode = 200,
) {
  return res.status(statusCode).json({ success: true, data, message });
}

export function sendList<T>(
  res: Response,
  data: T[],
  meta: { page: number; limit: number; total: number },
) {
  return res.status(200).json({
    success: true,
    data,
    meta: {
      ...meta,
      totalPages: Math.ceil(meta.total / meta.limit),
    },
  });
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  details?: Record<string, string[]>,
) {
  return res.status(statusCode).json({ success: false, error: message, statusCode, details });
}
