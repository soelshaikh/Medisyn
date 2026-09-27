import apiClient from "@/lib/apiClient";
import type { AdminProduct, ListResponse } from "@/types/admin";

const BASE = "/products";

export const productsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<{ success: boolean; data: AdminProduct[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
      `${BASE}/admin/all`, { params }
    ).then((r) => ({ products: r.data.data, total: r.data.meta.total, page: r.data.meta.page, limit: r.data.meta.limit })),

  getById: (id: string) =>
    apiClient.get<{ data: AdminProduct }>(`${BASE}/admin/${id}`).then((r) => r.data.data),

  create: (data: Record<string, unknown>) =>
    apiClient.post<{ data: AdminProduct }>(BASE, data).then((r) => r.data.data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch<{ data: AdminProduct }>(`${BASE}/${id}`, data).then((r) => r.data.data),

  archive: (id: string) =>
    apiClient.delete(`${BASE}/${id}`).then((r) => r.data),

  uploadImage: (id: string, file: File, alt?: string, isPrimary?: boolean) => {
    const fd = new FormData();
    fd.append("image", file);
    if (alt)       fd.append("alt", alt);
    if (isPrimary) fd.append("isPrimary", "true");
    return apiClient.post<{ data: AdminProduct }>(`${BASE}/${id}/images`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data.data);
  },

  setPrimaryImage: (id: string, url: string) =>
    apiClient.patch<{ data: AdminProduct }>(`${BASE}/${id}/images/primary`, { url })
      .then((r) => r.data.data),

  reorderImages: (id: string, urls: string[]) =>
    apiClient.patch<{ data: AdminProduct }>(`${BASE}/${id}/images/reorder`, { urls })
      .then((r) => r.data.data),

  removeImage: (id: string, url: string) =>
    apiClient.delete<{ data: AdminProduct }>(`${BASE}/${id}/images`, { data: { url } })
      .then((r) => r.data.data),
};

export const brandsApi = {
  list: () =>
    apiClient.get<{ data: Array<{ _id: string; name: string; slug: string; isActive: boolean }> }>("/brands/admin/all")
      .then((r) => r.data.data),

  getById: (id: string) =>
    apiClient.get<{ data: import("@/types/admin").AdminBrand }>(`/brands/admin/${id}`)
      .then((r) => r.data.data),

  create: (data: { name: string; description?: string; logoUrl?: string; website?: string }) =>
    apiClient.post<{ data: import("@/types/admin").AdminBrand }>("/brands", data).then((r) => r.data.data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch<{ data: import("@/types/admin").AdminBrand }>(`/brands/${id}`, data).then((r) => r.data.data),

  delete: (id: string) =>
    apiClient.delete(`/brands/${id}`).then((r) => r.data),
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
    apiClient.get("/coupons", { params }).then((r) => r.data.data as unknown[]),

  create: (data: Record<string, unknown>) =>
    apiClient.post("/coupons", data).then((r) => r.data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/coupons/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/coupons/${id}`).then((r) => r.data),
};
