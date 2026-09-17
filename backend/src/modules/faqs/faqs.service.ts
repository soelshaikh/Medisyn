import { FAQModel } from "./faqs.schema";
import { AppError } from "@/common/middleware/error.middleware";
import { logAction, type AuditActor } from "@/modules/audit/audit.service";

export async function listPublicFAQs() {
  return FAQModel.find({ isPublished: true }).sort({ category: 1, sortOrder: 1 }).lean();
}

export async function listAllFAQs(filters: { category?: string; page?: number; limit?: number } = {}) {
  const { category, page = 1, limit = 50 } = filters;
  const query: Record<string, unknown> = {};
  if (category) query.category = category;
  const [total, data] = await Promise.all([
    FAQModel.countDocuments(query),
    FAQModel.find(query).sort({ category: 1, sortOrder: 1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { data, total, page, limit };
}

export async function createFAQ(data: {
  question: string; answer: string; category?: string;
  sortOrder?: number; isPublished?: boolean;
}, actor?: AuditActor) {
  const faq = await FAQModel.create(data);

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     "faq.create",
    resource:   "faq",
    resourceId: String(faq._id),
    before:     null,
    after:      faq.toObject() as unknown as Record<string, unknown>,
    ipAddress:  actor?.ip,
  });

  return faq;
}

export async function updateFAQ(id: string, data: Partial<{
  question: string; answer: string; category: string;
  sortOrder: number; isPublished: boolean;
}>, actor?: AuditActor) {
  const before = await FAQModel.findById(id).lean();
  if (!before) throw new AppError("FAQ not found", 404);

  const faq = await FAQModel.findByIdAndUpdate(id, data, { new: true });
  if (!faq) throw new AppError("FAQ not found", 404);

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     "faq.update",
    resource:   "faq",
    resourceId: id,
    before:     before as Record<string, unknown>,
    after:      faq.toObject() as unknown as Record<string, unknown>,
    ipAddress:  actor?.ip,
  });

  return faq;
}

export async function deleteFAQ(id: string, actor?: AuditActor) {
  const before = await FAQModel.findById(id).lean();
  if (!before) throw new AppError("FAQ not found", 404);

  await FAQModel.findByIdAndDelete(id);

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     "faq.delete",
    resource:   "faq",
    resourceId: id,
    before:     before as Record<string, unknown>,
    after:      null,
    ipAddress:  actor?.ip,
  });
}

export async function reorderFAQs(items: Array<{ id: string; sortOrder: number }>) {
  await Promise.all(items.map(({ id, sortOrder }) =>
    FAQModel.findByIdAndUpdate(id, { sortOrder })
  ));
}

export async function getFAQCategories() {
  return FAQModel.distinct("category");
}
