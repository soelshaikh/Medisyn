import apiClient from "@/lib/apiClient";

export interface PharmacistTopic {
  _id:       string;
  name:      string;
  slug:      string;
  isActive:  boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const pharmacistTopicsApi = {
  listAll: () =>
    apiClient
      .get<{ data: PharmacistTopic[] }>("/ask-pharmacist-topics/admin/all")
      .then((r) => r.data.data),

  create: (data: { name: string; isActive?: boolean; sortOrder?: number }) =>
    apiClient
      .post<{ data: PharmacistTopic }>("/ask-pharmacist-topics", data)
      .then((r) => r.data.data),

  update: (id: string, data: Partial<{ name: string; isActive: boolean; sortOrder: number }>) =>
    apiClient
      .patch<{ data: PharmacistTopic }>(`/ask-pharmacist-topics/${id}`, data)
      .then((r) => r.data.data),

  delete: (id: string) =>
    apiClient.delete(`/ask-pharmacist-topics/${id}`).then((r) => r.data),

  batchSortOrder: (items: { id: string; sortOrder: number }[]) =>
    apiClient.patch("/ask-pharmacist-topics/sort-order", { items }).then((r) => r.data),
};
