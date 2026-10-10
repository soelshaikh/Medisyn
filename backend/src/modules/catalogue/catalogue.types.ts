export const INVENTORY_REASONS = [
  'RESTOCK',
  'DAMAGED',
  'MANUAL_ADJUSTMENT',
  'RETURN',
  'WRITE_OFF',
  'OTHER',
] as const;

export type InventoryReason = (typeof INVENTORY_REASONS)[number];

export type CouponType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export type CouponValidationRejectionReason =
  | 'EXPIRED'
  | 'INACTIVE'
  | 'USAGE_LIMIT_REACHED'
  | 'MINIMUM_NOT_MET'
  | 'INVALID_CODE';

export type StockStatus = 'in_stock' | 'out_of_stock' | 'low_stock';
