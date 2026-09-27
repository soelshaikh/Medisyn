import { apiClient } from "@/lib/apiClient";
import type { ApiResponse } from "@/types/api";

export interface CartItem {
  productId: string;
  name:      string;
  sku:       string;
  price:     number; // cents
  quantity:  number;
  imageUrl?: string;
}

export interface CartSummary {
  items:          CartItem[];
  subtotal:       number; // cents
  discountAmount: number; // cents
  couponCode:     string | null;
  total:          number; // cents
}

const EMPTY: CartSummary = { items: [], subtotal: 0, discountAmount: 0, couponCode: null, total: 0 };

export const cartApi = {
  get: async (): Promise<CartSummary> => {
    const { data } = await apiClient.get<ApiResponse<CartSummary>>("/cart");
    return data.data ?? EMPTY;
  },

  addItem: async (productId: string, quantity: number): Promise<CartSummary> => {
    const { data } = await apiClient.post<ApiResponse<CartSummary>>("/cart/items", { productId, quantity });
    return data.data;
  },

  updateItem: async (productId: string, quantity: number): Promise<CartSummary> => {
    const { data } = await apiClient.patch<ApiResponse<CartSummary>>(`/cart/items/${productId}`, { quantity });
    return data.data;
  },

  removeItem: async (productId: string): Promise<CartSummary> => {
    const { data } = await apiClient.delete<ApiResponse<CartSummary>>(`/cart/items/${productId}`);
    return data.data;
  },

  applyCoupon: async (code: string): Promise<CartSummary> => {
    const { data } = await apiClient.post<ApiResponse<CartSummary>>("/cart/coupon", { code });
    return data.data;
  },

  removeCoupon: async (): Promise<CartSummary> => {
    const { data } = await apiClient.delete<ApiResponse<CartSummary>>("/cart/coupon");
    return data.data;
  },
};

export function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function cartItemCount(cart: CartSummary | undefined) {
  return cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;
}
