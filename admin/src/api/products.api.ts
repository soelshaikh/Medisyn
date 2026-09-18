import apiClient from "@/lib/apiClient";
import type { AdminProduct, ListResponse } from "@/types/admin";

const BASE = "/products";

export const productsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<{ data: { products: AdminProduct[]; total: number; page: number; limit: number } }>(
      `${BASE}/admin/all`, { params }
    ).then((r) => r.data.data),

  getById: (id: string) =>
    apiClient.get<{ data: AdminProduct }>(`${BASE}/admin/${id}`).then((r) => r.data.data),

  create: (data: Record<string, unknown>) =>
    apiClient.post<{ data: AdminProduct }>(BASE, data).then((r) => r.data.data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch<{ data: AdminProduct }>(`${BASE}/${id}`, data).then((r) => r.data.data),

  archive: (id: string) =>
    apiClient.delete(`${BASE}/${id}`).then((r) => r.data),

  uploadImage: (id: string, file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    return apiClient.post(`${BASE}/${id}/images`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data);
  },
};

export const categoriesApi = {
  list: () =>
    apiClient.get<{ data: Array<{ _id: string; name: string; slug: string }> }>("/categories")
      .then((r) => r.data.data),

  listAdmin: () =>
    apiClient.get<{ data: Array<{ _id: string; name: string; slug: string; isActive: boolean }> }>("/categories/admin/all")
      .then((r) => r.data.data),

  create: (data: { name: string; description?: string; parentId?: string }) =>
    apiClient.post("/categories", data).then((r) => r.data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/categories/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/categories/${id}`).then((r) => r.data),
};

export const inventoryApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get("/admin/inventory", { params }).then((r) => r.data.data),

  lowStock: () =>
    apiClient.get("/admin/inventory/low-stock").then((r) => r.data.data),

  update: (productId: string, data: Record<string, unknown>) =>
    apiClient.patch(`/admin/inventory/${productId}`, data).then((r) => r.data),

  adjust: (productId: string, delta: number) =>
    apiClient.post(`/admin/inventory/${productId}/adjust`, { delta }).then((r) => r.data),
};

export const couponsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get("/coupons", { params }).then((r) => r.data.data),

  create: (data: Record<string, unknown>) =>
    apiClient.post("/coupons", data).then((r) => r.data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/coupons/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/coupons/${id}`).then((r) => r.data),
};
