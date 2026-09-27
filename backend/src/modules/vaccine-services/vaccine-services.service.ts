import { VaccineServiceModel } from "./vaccine-services.schema";
import { AppError } from "@/common/middleware/error.middleware";
import { logAction, type AuditActor } from "@/modules/audit/audit.service";

function toSlug(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
}

export async function listVaccineServices() {
  return VaccineServiceModel.find({ status: "active" }).sort({ sortOrder: 1, name: 1 }).lean();
}

export async function listAdminVaccineServices() {
  return VaccineServiceModel.find().sort({ sortOrder: 1, name: 1 }).lean();
}

export async function getVaccineService(id: string) {
  const svc = await VaccineServiceModel.findById(id).lean();
  if (!svc) throw new AppError("Vaccine service not found", 404);
  return svc;
}

export async function getVaccineServiceBySlug(slug: string) {
  const svc = await VaccineServiceModel.findOne({ slug, status: "active" }).lean();
  if (!svc) throw new AppError("Vaccine service not found", 404);
  return svc;
}

export async function createVaccineService(data: {
  name:             string;
  description?:     string;
  eligibilityNotes?:string;
  durationMinutes?: number;
  sortOrder?:       number;
}, actor: AuditActor) {
  const slug = toSlug(data.name);
  const existing = await VaccineServiceModel.findOne({ slug });
  if (existing) throw new AppError("A vaccine service with this name already exists", 409);

  const svc = await VaccineServiceModel.create({ ...data, slug });

  await logAction({
    userId: actor.id, userEmail: actor.email, actorName: actor.name,
    action: "vaccine_service.created", resource: "vaccine_service", resourceId: String(svc._id),
    details: { name: svc.name }, ipAddress: actor.ip,
  });

  return svc;
}

export async function updateVaccineService(id: string, data: Partial<{
  name: string; description: string; eligibilityNotes: string;
  durationMinutes: number; sortOrder: number; status: "active" | "inactive";
}>, actor: AuditActor) {
  const svc = await VaccineServiceModel.findById(id);
  if (!svc) throw new AppError("Vaccine service not found", 404);

  const before: Record<string, unknown> = {};
  if (data.name !== undefined)             { before.name             = svc.name;             svc.name             = data.name; svc.slug = toSlug(data.name); }
  if (data.description !== undefined)      { before.description      = svc.description;      svc.description      = data.description; }
  if (data.eligibilityNotes !== undefined) { before.eligibilityNotes = svc.eligibilityNotes; svc.eligibilityNotes = data.eligibilityNotes; }
  if (data.durationMinutes !== undefined)  { before.durationMinutes  = svc.durationMinutes;  svc.durationMinutes  = data.durationMinutes; }
  if (data.sortOrder !== undefined)        { before.sortOrder        = svc.sortOrder;        svc.sortOrder        = data.sortOrder; }
  if (data.status !== undefined)           { before.status           = svc.status;           svc.status           = data.status; }

  const saved = await svc.save();

  await logAction({
    userId: actor.id, userEmail: actor.email, actorName: actor.name,
    action: "vaccine_service.updated", resource: "vaccine_service", resourceId: id,
    before, after: data, ipAddress: actor.ip,
  });

  return saved;
}

export async function batchUpdateSortOrder(
  items: { id: string; sortOrder: number }[],
  actor: AuditActor,
) {
  if (items.length === 0) return { updated: 0 };

  await VaccineServiceModel.bulkWrite(
    items.map(({ id, sortOrder }) => ({
      updateOne: { filter: { _id: id }, update: { $set: { sortOrder } } },
    })),
  );

  await logAction({
    userId: actor.id, userEmail: actor.email, actorName: actor.name,
    action: "vaccine_service.sort_order_updated", resource: "vaccine_service",
    details: { count: items.length }, ipAddress: actor.ip,
  });

  return { updated: items.length };
}

export async function deleteVaccineService(id: string, actor: AuditActor) {
  const svc = await VaccineServiceModel.findByIdAndUpdate(id, { status: "inactive" }, { new: true });
  if (!svc) throw new AppError("Vaccine service not found", 404);

  await logAction({
    userId: actor.id, userEmail: actor.email, actorName: actor.name,
    action: "vaccine_service.deactivated", resource: "vaccine_service", resourceId: id,
    details: { name: svc.name }, ipAddress: actor.ip,
  });

  return svc;
}
