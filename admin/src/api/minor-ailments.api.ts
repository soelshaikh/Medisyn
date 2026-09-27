import apiClient from "@/lib/apiClient";

export interface AilmentCatalogItem {
  _id:         string;
  name:        string;
  slug:        string;
  description: string;
  isActive:    boolean;
  sortOrder:   number;
  createdAt:   string;
  updatedAt:   string;
}

export const ailmentsApi = {
  listAll: () =>
    apiClient
      .get<{ data: AilmentCatalogItem[] }>("/ailments/admin/all")
      .then((r) => r.data.data),

  create: (data: { name: string; slug?: string; description?: string; isActive?: boolean; sortOrder?: number }) =>
    apiClient
      .post<{ data: AilmentCatalogItem }>("/ailments", data)
      .then((r) => r.data.data),

  update: (id: string, data: Partial<{ name: string; description: string; isActive: boolean; sortOrder: number }>) =>
    apiClient
      .patch<{ data: AilmentCatalogItem }>(`/ailments/${id}`, data)
      .then((r) => r.data.data),

  delete: (id: string) =>
    apiClient.delete(`/ailments/${id}`).then((r) => r.data),

  batchSortOrder: (items: { id: string; sortOrder: number }[]) =>
    apiClient.patch("/ailments/sort-order", { items }).then((r) => r.data),
};
