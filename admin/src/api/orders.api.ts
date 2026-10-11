import apiClient from "@/lib/apiClient";
import type { AdminOrder, ListResponse } from "@/types/admin";

export const ordersApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient
      .get<{ data: AdminOrder[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
        "/admin/orders",
        { params },
      )
      .then((r) => ({
        data:  r.data.data,
        total: r.data.pagination.total,
        page:  r.data.pagination.page,
        limit: r.data.pagination.limit,
      } satisfies ListResponse<AdminOrder>)),

  getById: (id: string) =>
    apiClient.get<{ data: AdminOrder }>(`/admin/orders/${id}`).then((r) => r.data.data),

  updateStatus: (id: string, newStatus: string, note?: string) =>
    apiClient.patch(`/admin/orders/${id}/status`, { newStatus, note }).then((r) => r.data),

  addNote: (id: string, note: string) =>
    apiClient.patch(`/admin/orders/${id}/notes`, { note }).then((r) => r.data),

  cancel: (id: string, reason?: string) =>
    apiClient.post(`/admin/orders/${id}/cancel`, { reason }).then((r) => r.data),

  overrideBatchAllocations: (
    id: string,
    allocations: Array<{
      batchId: string; batchNumber: string; productId: string;
      productName: string; expiryDate: string; allocatedQty: number;
    }>,
  ) =>
    apiClient.patch(`/admin/orders/${id}/batch-allocations`, { allocations }).then((r) => r.data),
};
