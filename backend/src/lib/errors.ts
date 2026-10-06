// Typed error classes for the Vtech-Med API.

export type ErrorCode =
  | 'AUTH_MISSING'
  | 'AUTH_MALFORMED'
  | 'AUTH_INVALID_TOKEN'
  | 'AUTH_TOKEN_EXPIRED'
  | 'SESSION_REVOKED'
  | 'AUTH_VERSION_STALE'
  | 'FACILITY_NOT_FOUND'
  | 'FACILITY_INACTIVE'
  | 'FACILITY_SUSPENDED'
  | 'FACILITY_DEACTIVATED'
  | 'MODULE_NOT_AVAILABLE'
  | 'MODULE_DISABLED'
  | 'FEATURE_DISABLED'
  | 'FORBIDDEN'
  | 'USER_SUSPENDED'
  | 'ACCOUNT_INACTIVE'
  | 'EMAIL_IN_USE'
  | 'ACCOUNT_EXISTS_LOGIN'
  | 'INVALID_CREDENTIALS'
  | 'REFRESH_TOKEN_MISSING'
  | 'REFRESH_TOKEN_INVALID'
  | 'REFRESH_TOKEN_EXPIRED'
  | 'REFRESH_TOKEN_REUSE'
  | 'RESET_TOKEN_INVALID'
  | 'VERIFY_TOKEN_INVALID'
  | 'SERVICE_UNAVAILABLE'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'VALIDATION_ERROR';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class AuthError extends AppError {
  constructor(code: ErrorCode, message: string) {
    super(code, message, 401);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends AppError {
  constructor(code: ErrorCode, message?: string) {
    super(code, message ?? 'Access denied', 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message?: string) {
    super('NOT_FOUND', message ?? 'Resource not found', 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message?: string) {
    super('CONFLICT', message ?? 'Resource already exists', 409);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 422);
    this.name = 'ValidationError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(code: ErrorCode = 'SERVICE_UNAVAILABLE', message?: string) {
    super(code, message ?? 'Service temporarily unavailable', 503);
    this.name = 'ServiceUnavailableError';
  }
}
