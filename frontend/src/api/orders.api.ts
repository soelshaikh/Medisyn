import { apiClient } from "@/lib/apiClient";
import type { ApiResponse } from "@/types/api";

export interface MyOrder {
  _id:           string;
  orderNumber:   string;
  status:        string;
  total:         number;
  subtotal:      number;
  taxTotal:      number;
  discountAmount: number;
  couponCode:    string | null;
  paymentMethod: string;
  items: Array<{ name: string; sku: string; slug: string; imageUrl: string; price: number; quantity: number; lineTotal: number }>;
  shippingAddress: {
    fullName: string; phone: string; address1: string; address2: string;
    city: string; province: string; postalCode: string;
  };
  statusHistory: Array<{ status: string; changedAt: string; note: string }>;
  notes:         string;
  createdAt:     string;
}

export interface OrdersListData {
  docs: MyOrder[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface OrdersRaw {
  data:  MyOrder[];
  total: number;
  page:  number;
  limit: number;
}

export const ordersApi = {
  list: (page = 1, limit = 20) =>
    apiClient
      .get<ApiResponse<OrdersRaw>>("/orders/my", { params: { page, limit } })
      .then((r): OrdersListData => {
        const d = r.data.data;
        return {
          docs: d.data ?? [],
          meta: {
            page:       d.page ?? page,
            limit:      d.limit ?? limit,
            total:      d.total ?? 0,
            totalPages: Math.ceil((d.total ?? 0) / (d.limit || limit)),
          },
        };
      }),

  getById: (id: string) =>
    apiClient
      .get<ApiResponse<MyOrder>>(`/orders/my/${id}`)
      .then((r) => r.data.data),

  cancel: (id: string, reason?: string) =>
    apiClient
      .patch<ApiResponse<MyOrder>>(`/orders/my/${id}/cancel`, { reason: reason ?? "" })
      .then((r) => r.data.data),
};
