import { apiClient } from "@/lib/apiClient";
import type { ApiResponse, ApiListResponse } from "@/types/api";

export interface ProductImage {
  url:       string;
  alt:       string;
  isPrimary: boolean;
}

export interface Product {
  _id:                 string;
  name:                string;
  slug:                string;
  sku:                 string;
  description:         string;
  shortDescription:    string;
  categoryId:          { _id: string; name: string; slug: string } | string;
  brandId:             { _id: string; name: string; slug: string } | string | null;
  din:                 string;
  upc:                 string;
  images:              ProductImage[];
  price:               number; // cents
  compareAtPrice:      number | null; // cents
  requiresPrescription: boolean;
  ageRestriction:      number | null;
  status:              "draft" | "active" | "archived";
  tags:                string[];
  videoUrls:           string[];
  weight:              number | null;
  createdAt:           string;
  updatedAt:           string;
}

export interface ProductListResponse {
  data:  Product[];
  meta:  { page: number; limit: number; total: number; totalPages: number };
}

export interface ProductFilters {
  search?:              string;
  categoryId?:          string;
  brandId?:             string;
  requiresPrescription?: boolean;
  inStock?:             boolean;
  priceMin?:            number;
  priceMax?:            number;
  page?:                number;
  limit?:               number;
}

export const productsApi = {
  list: async (filters: ProductFilters = {}): Promise<ProductListResponse> => {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined && v !== ""),
    );
    const { data } = await apiClient.get<ApiListResponse<Product>>("/products", { params });
    return { data: data.data, meta: data.meta };
  },

  getBySlug: async (slug: string): Promise<Product> => {
    const { data } = await apiClient.get<ApiResponse<Product>>(`/products/${slug}`);
    return data.data;
  },
};

export const categoriesPublicApi = {
  list: async (): Promise<Array<{ _id: string; name: string; slug: string }>> => {
    const { data } = await apiClient.get<ApiResponse<Array<{ _id: string; name: string; slug: string }>>>("/categories");
    return data.data;
  },
};

export const brandsPublicApi = {
  list: async (): Promise<Array<{ _id: string; name: string; slug: string }>> => {
    const { data } = await apiClient.get<ApiResponse<Array<{ _id: string; name: string; slug: string }>>>("/brands");
    return data.data;
  },
};

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function primaryImage(images: ProductImage[]): string | null {
  return images.find((i) => i.isPrimary)?.url ?? images[0]?.url ?? null;
}
