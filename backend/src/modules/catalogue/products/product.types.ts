export interface CreateVariantInput {
  sku: string;
  dimensionValue: string;
  price: string;
  compareAtPrice?: string | null;
}

export interface UpdateVariantInput {
  sku?: string;
  dimensionValue?: string;
  price?: string;
  compareAtPrice?: string | null;
  isActive?: boolean;
}

export interface CreateProductInput {
  sku: string;
  name: string;
  price: string;
  categoryId?: string | null;
  slug?: string | null;
  description?: string | null;
  shortDescription?: string | null;
  brand?: string | null;
  images?: string[];
  compareAtPrice?: string | null;
  variantDimensionLabel?: string | null;
  lowStockThreshold?: number;
  isFeatured?: boolean;
  isActive?: boolean;
  variants?: CreateVariantInput[];
}

export interface UpdateProductInput {
  sku?: string;
  name?: string;
  price?: string;
  categoryId?: string | null;
  slug?: string | null;
  description?: string | null;
  shortDescription?: string | null;
  brand?: string | null;
  images?: string[];
  compareAtPrice?: string | null;
  variantDimensionLabel?: string | null;
  lowStockThreshold?: number;
  isFeatured?: boolean;
  isActive?: boolean;
}
