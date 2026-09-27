import slugify from "slugify";
import { BrandModel } from "./brands.schema";
import { AppError } from "@/common/middleware/error.middleware";

function makeSlug(name: string) {
  return slugify(name, { lower: true, strict: true });
}

export async function listBrands(activeOnly = true) {
  const query = activeOnly ? { isActive: true } : {};
  return BrandModel.find(query).sort({ name: 1 }).lean();
}

export async function getBrandBySlug(slug: string) {
  const brand = await BrandModel.findOne({ slug, isActive: true }).lean();
  if (!brand) throw new AppError("Brand not found", 404);
  return brand;
}

export async function getBrandById(id: string) {
  const brand = await BrandModel.findById(id).lean();
  if (!brand) throw new AppError("Brand not found", 404);
  return brand;
}

export async function createBrand(data: {
  name: string; description?: string; logoUrl?: string; website?: string; isActive?: boolean;
}) {
  const slug = makeSlug(data.name);
  const existing = await BrandModel.findOne({ slug });
  if (existing) throw new AppError("Brand with this name already exists", 409);
  return BrandModel.create({ ...data, slug });
}

export async function updateBrand(id: string, data: Partial<{
  name: string; description: string; logoUrl: string; website: string; isActive: boolean;
}>) {
  const update: Record<string, unknown> = { ...data };
  if (data.name) update.slug = makeSlug(data.name);

  const brand = await BrandModel.findByIdAndUpdate(id, update, { new: true });
  if (!brand) throw new AppError("Brand not found", 404);
  return brand;
}

export async function deleteBrand(id: string) {
  const brand = await BrandModel.findByIdAndDelete(id);
  if (!brand) throw new AppError("Brand not found", 404);
  return brand;
}
