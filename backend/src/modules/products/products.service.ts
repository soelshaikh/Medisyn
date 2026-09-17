import slugify from "slugify";
import path from "path";
import fs from "fs";
import { ProductModel } from "./products.schema";
import { InventoryModel } from "@/modules/inventory/inventory.schema";
import { AppError } from "@/common/middleware/error.middleware";

function makeSlug(name: string) {
  return slugify(name, { lower: true, strict: true });
}

export interface ProductFilters {
  categoryId?:          string;
  search?:              string;
  status?:              string;
  requiresPrescription?: boolean;
  inStock?:             boolean;
  priceMin?:            number;
  priceMax?:            number;
  page?:                number;
  limit?:               number;
}

export async function listProducts(filters: ProductFilters = {}, adminView = false) {
  const { categoryId, search, requiresPrescription, inStock, priceMin, priceMax,
          page = 1, limit = 24 } = filters;

  const query: Record<string, unknown> = {};
  if (!adminView) query.status = "active";
  else if (filters.status) query.status = filters.status;

  if (categoryId) query.categoryId = categoryId;
  if (requiresPrescription !== undefined) query.requiresPrescription = requiresPrescription;
  if (priceMin !== undefined || priceMax !== undefined) {
    query.price = {};
    if (priceMin) (query.price as Record<string, number>).$gte = priceMin;
    if (priceMax) (query.price as Record<string, number>).$lte = priceMax;
  }
  if (search) query.$text = { $search: search };

  const [total, products] = await Promise.all([
    ProductModel.countDocuments(query),
    ProductModel.find(query)
      .populate("categoryId", "name slug")
      .sort(search ? { score: { $meta: "textScore" } } : { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  /* If inStock filter, join inventory */
  if (inStock !== undefined) {
    const productIds = products.map((p) => String(p._id));
    const inventories = await InventoryModel.find({ productId: { $in: productIds } }).lean();
    const stockMap = new Map(inventories.map((i) => [String(i.productId), i.quantity]));
    const filtered = products.filter((p) => {
      const qty = stockMap.get(String(p._id)) ?? 0;
      return inStock ? qty > 0 : qty === 0;
    });
    return { products: filtered, total: filtered.length, page, limit };
  }

  return { products, total, page, limit };
}

export async function getProductBySlug(slug: string): Promise<Record<string, unknown>> {
  const product = await ProductModel.findOne({ slug, status: "active" })
    .populate("categoryId", "name slug")
    .lean<Record<string, unknown>>();
  if (!product) throw new AppError("Product not found", 404);

  const inventory = await InventoryModel.findOne({ productId: product._id as string }).lean();
  return { ...product, inventory };
}

export async function getProductById(id: string): Promise<Record<string, unknown>> {
  const product = await ProductModel.findById(id)
    .populate("categoryId", "name slug")
    .lean<Record<string, unknown>>();
  if (!product) throw new AppError("Product not found", 404);
  const inventory = await InventoryModel.findOne({ productId: id }).lean();
  return { ...product, inventory };
}

export async function createProduct(data: {
  name: string; sku: string; description?: string; shortDescription?: string;
  categoryId: string; price: number; compareAtPrice?: number | null;
  requiresPrescription?: boolean; ageRestriction?: number | null;
  status?: string; tags?: string[]; weight?: number | null;
  metaTitle?: string; metaDescription?: string;
  initialStock?: number; lowStockThreshold?: number;
}) {
  const slug = makeSlug(data.name);
  const [slugExists, skuExists] = await Promise.all([
    ProductModel.findOne({ slug }),
    ProductModel.findOne({ sku: data.sku.toUpperCase() }),
  ]);
  if (slugExists) throw new AppError("Product with this name already exists", 409);
  if (skuExists)  throw new AppError("SKU already in use", 409);

  const { initialStock = 0, lowStockThreshold = 10, ...productData } = data;
  const product = await ProductModel.create({ ...productData, slug });

  await InventoryModel.create({
    productId: product._id,
    quantity: initialStock,
    lowStockThreshold,
  });

  return product;
}

export async function updateProduct(id: string, data: Partial<{
  name: string; description: string; shortDescription: string;
  categoryId: string; price: number; compareAtPrice: number | null;
  requiresPrescription: boolean; ageRestriction: number | null;
  status: string; tags: string[]; weight: number | null;
  metaTitle: string; metaDescription: string;
}>) {
  const update: Record<string, unknown> = { ...data };
  if (data.name) update.slug = makeSlug(data.name);

  const product = await ProductModel.findByIdAndUpdate(id, update, { new: true });
  if (!product) throw new AppError("Product not found", 404);
  return product;
}

export async function archiveProduct(id: string) {
  const product = await ProductModel.findByIdAndUpdate(id, { status: "archived" }, { new: true });
  if (!product) throw new AppError("Product not found", 404);
  return product;
}

export async function addProductImage(id: string, image: { url: string; alt?: string; isPrimary?: boolean }) {
  const product = await ProductModel.findById(id);
  if (!product) throw new AppError("Product not found", 404);

  /* If isPrimary, unset all others */
  if (image.isPrimary) product.images.forEach((img) => { img.isPrimary = false; });
  product.images.push({ url: image.url, alt: image.alt ?? "", isPrimary: image.isPrimary ?? false });
  return product.save();
}

export async function removeProductImage(productId: string, imageUrl: string) {
  const product = await ProductModel.findById(productId);
  if (!product) throw new AppError("Product not found", 404);

  const idx = product.images.findIndex((i) => i.url === imageUrl);
  if (idx === -1) throw new AppError("Image not found", 404);

  /* Delete file from disk */
  const filePath = path.join(process.cwd(), "uploads", path.basename(imageUrl));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  product.images.splice(idx, 1);
  return product.save();
}
