export interface CartItemLive {
  id: string;
  cartId: string;
  facilityId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  priceSnapshot: string;
  productNameSnapshot: string;
  variantLabelSnapshot: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Live fields from JOIN
  currentPrice: string;
  stockQuantity: number;
  isActive: boolean;
  variantLabel: string | null;
  sku: string;
}

export interface CartResponse {
  id: string | null;
  facilityId: string;
  cartToken: string | null;
  itemCount: number;
  items: CartItemResponse[];
  subtotal: string;
}

export interface CartItemResponse {
  id: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantLabel: string | null;
  sku: string;
  quantity: number;
  priceSnapshot: string;
  currentPrice: string;
  lineTotal: string;
  stockQuantity: number;
  isActive: boolean;
}

export interface AddItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface UpdateItemInput {
  quantity: number;
}

export interface MergeCartInput {
  cartToken: string;
}
