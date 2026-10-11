import apiClient from "@/lib/apiClient";
import type { AuditLog, ListResponse } from "@/types/admin";

export const auditApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient
      .get<{ data: AuditLog[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
        "/admin/audit",
        { params },
      )
      .then((r): ListResponse<AuditLog> => ({
        data:  r.data.data,
        total: r.data.pagination.total,
        page:  r.data.pagination.page,
        limit: r.data.pagination.limit,
      })),
};
