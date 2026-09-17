import slugify from "slugify";
import { AilmentCatalogModel, type IIntakeField } from "./ailment-catalog.schema";
import { AppError } from "@/common/middleware/error.middleware";
import { logAction, type AuditActor } from "@/modules/audit/audit.service";

export async function listPublicAilments() {
  return AilmentCatalogModel.find({ isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .select("-__v")
    .lean();
}

export async function listAllAilments() {
  return AilmentCatalogModel.find().sort({ sortOrder: 1, name: 1 }).lean();
}

export async function getAilmentBySlug(slug: string) {
  const ailment = await AilmentCatalogModel.findOne({ slug, isActive: true }).lean();
  if (!ailment) throw new AppError("Ailment not found", 404);
  return ailment;
}

export async function createAilment(data: {
  name: string;
  description?: string;
  intakeFormFields?: IIntakeField[];
  sortOrder?: number;
}, actor?: AuditActor) {
  const slug = slugify(data.name, { lower: true, strict: true });
  const exists = await AilmentCatalogModel.findOne({ slug });
  if (exists) throw new AppError("Ailment with this name already exists", 409);

  const ailment = await AilmentCatalogModel.create({ ...data, slug });

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     "ailment_catalog.create",
    resource:   "ailment_catalog",
    resourceId: String(ailment._id),
    before:     null,
    after:      ailment.toObject() as unknown as Record<string, unknown>,
    ipAddress:  actor?.ip,
  });

  return ailment;
}

export async function updateAilment(id: string, data: Partial<{
  name: string; description: string;
  intakeFormFields: IIntakeField[]; isActive: boolean; sortOrder: number;
}>, actor?: AuditActor) {
  const before = await AilmentCatalogModel.findById(id).lean();
  if (!before) throw new AppError("Ailment not found", 404);

  const update: Record<string, unknown> = { ...data };
  if (data.name) update.slug = slugify(data.name, { lower: true, strict: true });

  const ailment = await AilmentCatalogModel.findByIdAndUpdate(id, update, { new: true });
  if (!ailment) throw new AppError("Ailment not found", 404);

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     "ailment_catalog.update",
    resource:   "ailment_catalog",
    resourceId: id,
    before:     before as Record<string, unknown>,
    after:      ailment.toObject() as unknown as Record<string, unknown>,
    ipAddress:  actor?.ip,
  });

  return ailment;
}

export async function deleteAilment(id: string, actor?: AuditActor) {
  const before = await AilmentCatalogModel.findById(id).lean();
  if (!before) throw new AppError("Ailment not found", 404);

  /* Block if any active requests exist */
  const { AilmentRequestModel } = await import("./ailment-request.schema");
  const inUse = await AilmentRequestModel.countDocuments({ ailmentId: id, status: { $nin: ["closed"] } });
  if (inUse > 0) throw new AppError("Cannot delete ailment with active requests", 409);

  await AilmentCatalogModel.findByIdAndDelete(id);

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     "ailment_catalog.delete",
    resource:   "ailment_catalog",
    resourceId: id,
    before:     before as Record<string, unknown>,
    after:      null,
    ipAddress:  actor?.ip,
  });
}

export async function updateAilmentFields(id: string, fields: IIntakeField[], actor?: AuditActor) {
  const before = await AilmentCatalogModel.findById(id).lean();
  if (!before) throw new AppError("Ailment not found", 404);

  /* Sort by sortOrder before saving */
  const sorted = [...fields].sort((a, b) => a.sortOrder - b.sortOrder);
  const ailment = await AilmentCatalogModel.findByIdAndUpdate(
    id, { intakeFormFields: sorted }, { new: true }
  );
  if (!ailment) throw new AppError("Ailment not found", 404);

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     "ailment_catalog.fields_updated",
    resource:   "ailment_catalog",
    resourceId: id,
    before:     { intakeFormFields: before.intakeFormFields },
    after:      { intakeFormFields: sorted },
    ipAddress:  actor?.ip,
  });

  return ailment;
}
