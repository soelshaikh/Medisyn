import apiClient from "@/lib/apiClient";
import type { AdminProduct } from "@/types/admin";

const PRODUCTS_BASE = "/catalogue/products";
const CATEGORIES_BASE = "/catalogue/categories";
const COUPONS_BASE = "/catalogue/coupons";
const INVENTORY_BASE = "/catalogue/inventory";

export const productsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient
      .get<{ data: AdminProduct[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
        PRODUCTS_BASE,
        { params },
      )
      .then((r) => ({ products: r.data.data, total: r.data.pagination.total, page: r.data.pagination.page, limit: r.data.pagination.limit })),

  getById: (id: string) =>
    apiClient.get<{ data: AdminProduct }>(`${PRODUCTS_BASE}/${id}`).then((r) => r.data.data),

  create: (data: Record<string, unknown>) =>
    apiClient.post<{ data: AdminProduct }>(PRODUCTS_BASE, data).then((r) => r.data.data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch<{ data: AdminProduct }>(`${PRODUCTS_BASE}/${id}`, data).then((r) => r.data.data),

  archive: (id: string) =>
    apiClient.delete(`${PRODUCTS_BASE}/${id}`).then((r) => r.data),

  uploadImage: (id: string, file: File, alt?: string, isPrimary?: boolean) => {
    const fd = new FormData();
    fd.append("image", file);
    if (alt)       fd.append("alt", alt);
    if (isPrimary) fd.append("isPrimary", "true");
    return apiClient.post<{ data: AdminProduct }>(`${PRODUCTS_BASE}/${id}/images`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data.data);
  },

  setPrimaryImage: (id: string, url: string) =>
    apiClient.patch<{ data: AdminProduct }>(`${PRODUCTS_BASE}/${id}/images/primary`, { url })
      .then((r) => r.data.data),

  reorderImages: (id: string, urls: string[]) =>
    apiClient.patch<{ data: AdminProduct }>(`${PRODUCTS_BASE}/${id}/images/reorder`, { urls })
      .then((r) => r.data.data),

  removeImage: (id: string, url: string) =>
    apiClient.delete<{ data: AdminProduct }>(`${PRODUCTS_BASE}/${id}/images`, { data: { url } })
      .then((r) => r.data.data),
};

export const categoriesApi = {
  list: () =>
    apiClient.get<{ data: Array<{ id: string; name: string; slug: string }> }>(CATEGORIES_BASE)
      .then((r) => r.data.data),

  listAdmin: () =>
    apiClient.get<{ data: Array<{ id: string; name: string; slug: string; isActive: boolean }> }>(CATEGORIES_BASE)
      .then((r) => r.data.data),

  create: (data: { name: string; description?: string; parentId?: string }) =>
    apiClient.post(CATEGORIES_BASE, data).then((r) => r.data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`${CATEGORIES_BASE}/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`${CATEGORIES_BASE}/${id}`).then((r) => r.data),
};

export const inventoryApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get(INVENTORY_BASE, { params }).then((r) => r.data.data),

  lowStock: () =>
    apiClient.get(`${INVENTORY_BASE}/low-stock`).then((r) => r.data.data),

  nearExpiry: (days?: number) =>
    apiClient.get(`${INVENTORY_BASE}/near-expiry`, { params: days ? { days } : {} }).then((r) => r.data.data),

  allMovements: (params?: Record<string, unknown>) =>
    apiClient.get(`${INVENTORY_BASE}/movements`, { params }).then((r) => r.data.data),

  get: (productId: string) =>
    apiClient.get(`${INVENTORY_BASE}/${productId}`).then((r) => r.data.data),

  update: (productId: string, data: Record<string, unknown>) =>
    apiClient.patch(`${INVENTORY_BASE}/${productId}`, data).then((r) => r.data),

  adjust: (productId: string, delta: number) =>
    apiClient.post(`${INVENTORY_BASE}/${productId}/adjust`, { delta }).then((r) => r.data),

  /* Batch endpoints */
  listBatches: (productId: string) =>
    apiClient.get(`${INVENTORY_BASE}/${productId}/batches`).then((r) => r.data.data),

  addBatch: (productId: string, data: Record<string, unknown>) =>
    apiClient.post(`${INVENTORY_BASE}/${productId}/batches`, data).then((r) => r.data.data),

  updateBatch: (productId: string, batchId: string, data: Record<string, unknown>) =>
    apiClient.patch(`${INVENTORY_BASE}/${productId}/batches/${batchId}`, data).then((r) => r.data.data),

  recallBatch: (productId: string, batchId: string, reason: string) =>
    apiClient.post(`${INVENTORY_BASE}/${productId}/batches/${batchId}/recall`, { reason }).then((r) => r.data.data),

  adjustBatch: (productId: string, batchId: string, delta: number, reason: string) =>
    apiClient.post(`${INVENTORY_BASE}/${productId}/batches/${batchId}/adjust`, { delta, reason }).then((r) => r.data.data),

  batchMovements: (productId: string, batchId: string, params?: Record<string, unknown>) =>
    apiClient.get(`${INVENTORY_BASE}/${productId}/batches/${batchId}/movements`, { params }).then((r) => r.data.data),

  productMovements: (productId: string, params?: Record<string, unknown>) =>
    apiClient.get(`${INVENTORY_BASE}/${productId}/movements`, { params }).then((r) => r.data.data),
};

// brands has no backend route yet — calls will 404 until backend brands router is added
const BRANDS_BASE = "/catalogue/brands";

export const brandsApi = {
  list: () =>
    apiClient.get<{ data: Array<{ id: string; name: string; slug: string; isActive: boolean }> }>(BRANDS_BASE)
      .then((r) => r.data.data),

  getById: (id: string) =>
    apiClient.get<{ data: import("@/types/admin").AdminBrand }>(`${BRANDS_BASE}/${id}`)
      .then((r) => r.data.data),

  create: (data: { name: string; description?: string; logoUrl?: string; website?: string }) =>
    apiClient.post<{ data: import("@/types/admin").AdminBrand }>(BRANDS_BASE, data).then((r) => r.data.data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch<{ data: import("@/types/admin").AdminBrand }>(`${BRANDS_BASE}/${id}`, data).then((r) => r.data.data),

  delete: (id: string) =>
    apiClient.delete(`${BRANDS_BASE}/${id}`).then((r) => r.data),
};

export const couponsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get(COUPONS_BASE, { params }).then((r) => r.data.data as unknown[]),

  create: (data: Record<string, unknown>) =>
    apiClient.post(COUPONS_BASE, data).then((r) => r.data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`${COUPONS_BASE}/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`${COUPONS_BASE}/${id}`).then((r) => r.data),
};
