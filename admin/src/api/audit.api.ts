import apiClient from "@/lib/apiClient";
import type { AuditLog, ListResponse } from "@/types/admin";

export const auditApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<{ data: ListResponse<AuditLog> }>("/admin/audit", { params }).then((r) => r.data.data),
};
