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
  | 'EMAIL_NOT_VERIFIED'
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
  | 'VALIDATION_ERROR'
  // Facility resolution (public catalogue endpoints)
  | 'MISSING_FACILITY_ID'
  | 'INVALID_FACILITY_ID'
  // Catalogue — products
  | 'PRODUCT_NOT_FOUND'
  | 'SKU_CONFLICT'
  | 'SLUG_CONFLICT'
  | 'PRODUCT_ALREADY_INACTIVE'
  | 'VARIANT_NOT_FOUND'
  | 'VARIANT_SKU_CONFLICT'
  | 'VARIANT_DIMENSION_REQUIRED'
  // Catalogue — categories
  | 'CATEGORY_NOT_FOUND'
  | 'PARENT_NOT_FOUND'
  | 'CYCLE_DETECTED'
  | 'CATEGORY_HAS_ACTIVE_CHILDREN'
  // Catalogue — inventory
  | 'INVENTORY_RECORD_NOT_FOUND'
  | 'INSUFFICIENT_STOCK'
  // Catalogue — coupons
  | 'COUPON_NOT_FOUND'
  | 'COUPON_CODE_CONFLICT'
  | 'COUPON_CODE_EXISTS'
  | 'COUPON_ALREADY_INACTIVE'
  | 'IMMUTABLE_FIELD'
  // Commerce — cart
  | 'CART_EMPTY'
  | 'CART_ITEM_NOT_FOUND'
  | 'CART_ITEM_LIMIT_EXCEEDED'
  | 'CART_TOKEN_NOT_FOUND'
  // Commerce — checkout
  | 'PREVIEW_TOKEN_REQUIRED'
  | 'PREVIEW_TOKEN_EXPIRED'
  | 'PREVIEW_TOKEN_INVALID'
  // Commerce — orders
  | 'INVALID_STATUS_TRANSITION'
  | 'ORDER_NOT_FOUND'
  // Commerce — tax
  | 'INVALID_PROVINCE'
  // Commerce — shipping methods
  | 'SHIPPING_METHOD_NOT_FOUND'
  | 'SHIPPING_METHOD_NAME_EXISTS'
  | 'SHIPPING_METHOD_ALREADY_INACTIVE'
  // Healthcare — prescriptions
  | 'PRESCRIPTION_REQUEST_NOT_FOUND'
  // Healthcare — compounding
  | 'COMPOUNDING_REQUEST_NOT_FOUND'
  // Healthcare — minor ailments
  | 'AILMENT_NOT_FOUND'
  | 'AILMENT_INACTIVE'
  | 'AILMENT_NAME_EXISTS'
  // Healthcare — ask-a-pharmacist
  | 'CONVERSATION_NOT_FOUND'
  | 'CONVERSATION_CLOSED'
  // Healthcare — shared
  | 'HEALTHCARE_INVALID_STATUS_TRANSITION'
  // Appointments — vaccine services
  | 'VACCINE_SERVICE_NOT_FOUND'
  | 'VACCINE_SERVICE_INACTIVE'
  | 'VACCINE_SERVICE_NAME_EXISTS'
  // Appointments — availability slots
  | 'SLOT_NOT_FOUND'
  | 'SLOT_FULL'
  | 'SLOT_INACTIVE'
  | 'SLOT_CAPACITY_BELOW_BOOKED'
  // Appointments — bookings
  | 'APPOINTMENT_NOT_FOUND'
  | 'APPOINTMENT_INVALID_STATUS_TRANSITION'
  | 'APPOINTMENT_DUPLICATE_BOOKING';

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
