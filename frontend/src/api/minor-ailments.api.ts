import { apiClient } from "@/lib/apiClient";
import type { ApiResponse } from "@/types/api";

export interface AilmentCatalogItem {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  intakeFormFields: Array<{
    label: string;
    type: "text" | "textarea" | "select" | "radio" | "checkbox";
    options: string[];
    placeholder: string;
    required: boolean;
    sortOrder: number;
  }>;
}

export interface AilmentRequest {
  _id: string;
  ailmentId: string;
  ailmentName?: string;
  formData: Record<string, unknown>;
  notes?: string;
  status: "submitted" | "reviewing" | "responded" | "closed";
  responseText?: string;
  respondedAt?: string;
  createdAt: string;
}

export interface AilmentListData {
  docs: AilmentRequest[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export const minorAilmentsApi = {
  listCatalog: () =>
    apiClient
      .get<ApiResponse<AilmentCatalogItem[]>>("/ailments")
      .then((r) => r.data.data),

  listMyRequests: (page = 1, limit = 20) =>
    apiClient
      .get<ApiResponse<{ data: AilmentRequest[]; total: number; page: number; limit: number }>>("/ailment-requests/my", { params: { page, limit } })
      .then((r): AilmentListData => {
        const d = r.data.data;
        return {
          docs: d.data,
          meta: { page: d.page, limit: d.limit, total: d.total, totalPages: Math.ceil(d.total / d.limit) },
        };
      }),

  create: (dto: { ailmentId: string; formData: Record<string, unknown>; notes?: string }) =>
    apiClient
      .post<ApiResponse<AilmentRequest>>("/ailment-requests", dto)
      .then((r) => r.data.data),
};
