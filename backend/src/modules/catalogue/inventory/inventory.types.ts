import type { InventoryReason } from '../catalogue.types';

export interface AdjustInput {
  variantId?: string | null;
  quantityDelta: number;
  reason: InventoryReason;
  note?: string | null;
}

export interface InventoryRecordRow {
  id: string;
  facilityId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  allowNegative: boolean;
  updatedAt: Date;
}

export interface InventoryTransactionRow {
  id: string;
  facilityId: string;
  inventoryRecordId: string;
  productId: string;
  variantId: string | null;
  quantityDelta: number;
  resultingBalance: number;
  reason: string;
  note: string | null;
  actorId: string | null;
  createdAt: Date;
}

export interface InventoryHistoryRow extends InventoryTransactionRow {
  actorName: string | null;
}

export interface LowStockRow {
  productId: string;
  productName: string;
  variantId: string | null;
  variantDimensionValue: string | null;
  quantity: number;
  lowStockThreshold: number;
}

export interface InventoryForProductRow {
  id: string;
  variantId: string | null;
  dimensionValue: string | null;
  quantity: number;
  allowNegative: boolean;
}
