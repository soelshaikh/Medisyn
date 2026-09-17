import slugify from "slugify";
import { CategoryModel } from "./categories.schema";
import { AppError } from "@/common/middleware/error.middleware";
import { logAction, type AuditActor } from "@/modules/audit/audit.service";

function makeSlug(name: string) {
  return slugify(name, { lower: true, strict: true });
}

export async function listCategories() {
  return CategoryModel.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
}

export async function listAllCategories() {
  return CategoryModel.find().sort({ sortOrder: 1, name: 1 }).lean();
}

export async function getCategoryBySlug(slug: string) {
  const cat = await CategoryModel.findOne({ slug, isActive: true }).lean();
  if (!cat) throw new AppError("Category not found", 404);
  return cat;
}

export async function createCategory(data: {
  name: string;
  description?: string;
  parentId?: string | null;
  image?: string | null;
  sortOrder?: number;
}, actor?: AuditActor) {
  const slug = makeSlug(data.name);
  const exists = await CategoryModel.findOne({ slug });
  if (exists) throw new AppError("Category with this name already exists", 409);

  const cat = await CategoryModel.create({ ...data, slug });

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     "category.create",
    resource:   "category",
    resourceId: String(cat._id),
    before:     null,
    after:      cat.toObject() as unknown as Record<string, unknown>,
    ipAddress:  actor?.ip,
  });

  return cat;
}

export async function updateCategory(id: string, data: Partial<{
  name: string; description: string; parentId: string | null;
  image: string | null; sortOrder: number; isActive: boolean;
}>, actor?: AuditActor) {
  const before = await CategoryModel.findById(id).lean();
  if (!before) throw new AppError("Category not found", 404);

  const update: Record<string, unknown> = { ...data };
  if (data.name) update.slug = makeSlug(data.name);

  const cat = await CategoryModel.findByIdAndUpdate(id, update, { new: true });
  if (!cat) throw new AppError("Category not found", 404);

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     "category.update",
    resource:   "category",
    resourceId: id,
    before:     before as Record<string, unknown>,
    after:      cat.toObject() as unknown as Record<string, unknown>,
    ipAddress:  actor?.ip,
  });

  return cat;
}

export async function deleteCategory(id: string, actor?: AuditActor) {
  const cat = await CategoryModel.findById(id).lean();
  if (!cat) throw new AppError("Category not found", 404);

  const { ProductModel } = await import("@/modules/products/products.schema");
  const inUse = await ProductModel.countDocuments({ categoryId: id, status: { $ne: "archived" } });
  if (inUse > 0) throw new AppError("Cannot delete category with active products", 409);

  await CategoryModel.findByIdAndDelete(id);

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     "category.delete",
    resource:   "category",
    resourceId: id,
    before:     cat as Record<string, unknown>,
    after:      null,
    ipAddress:  actor?.ip,
  });
}
