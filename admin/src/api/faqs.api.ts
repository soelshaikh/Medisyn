import apiClient from "@/lib/apiClient";
import type { FAQ, ListResponse } from "@/types/admin";

const BASE = "/admin/faqs";

export const faqsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<{ data: ListResponse<FAQ> }>(BASE, { params }).then((r) => r.data.data),

  categories: () =>
    apiClient.get<{ data: string[] }>("/faqs/categories").then((r) => r.data.data),

  create: (data: { question: string; answer: string; category?: string; sortOrder?: number; isPublished?: boolean }) =>
    apiClient.post<{ data: FAQ }>(BASE, data).then((r) => r.data.data),

  update: (id: string, data: Partial<{ question: string; answer: string; category: string; sortOrder: number; isPublished: boolean }>) =>
    apiClient.patch<{ data: FAQ }>(`${BASE}/${id}`, data).then((r) => r.data.data),

  delete: (id: string) =>
    apiClient.delete(`${BASE}/${id}`).then((r) => r.data),

  reorder: (items: Array<{ id: string; sortOrder: number }>) =>
    apiClient.patch(`${BASE}/reorder`, { items }).then((r) => r.data),
};
