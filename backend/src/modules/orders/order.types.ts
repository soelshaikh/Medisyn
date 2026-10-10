export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'ready'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['processing', 'cancelled'],
  processing: ['ready'],
  ready:      ['shipped'],
  shipped:    ['delivered'],
  delivered:  ['refunded'],
  cancelled:  [],
  refunded:   [],
};

export interface OrderItem {
  id: string;
  orderId: string;
  facilityId: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  variantLabel: string | null;
  sku: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  createdAt: Date;
}

export interface OrderStatusHistoryEntry {
  id: string;
  orderId: string;
  facilityId: string;
  previousStatus: OrderStatus | null;
  newStatus: OrderStatus;
  changedById: string | null;
  changedByName: string | null;
  note: string | null;
  createdAt: Date;
}

export interface OrderSummary {
  id: string;
  facilityId: string;
  patientId: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: string;
  taxTotal: string;
  shippingCost: string;
  total: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderDetail extends OrderSummary {
  shippingAddress: Record<string, unknown>;
  shippingMethodId: string | null;
  shippingMethodSnapshot: Record<string, unknown>;
  taxBreakdown: unknown[];
  items: OrderItem[];
  statusHistory: OrderStatusHistoryEntry[];
}

export interface AdminOrderDetail extends OrderDetail {
  notes: string | null;
  patientName: string;
  patientEmail: string;
}

export interface PlaceOrderResult {
  orderId: string;
  orderNumber: string;
  status: 'pending';
  breakdown: {
    subtotal: string;
    taxBreakdown: unknown[];
    taxTotal: string;
    shippingCost: string;
    total: string;
  };
  estimatedDelivery: {
    min: string;
    max: string;
  };
}
