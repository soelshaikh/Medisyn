import type { PipelineStage } from "mongoose";
import { InventoryModel } from "./inventory.schema";
import { AppError } from "@/common/middleware/error.middleware";
import { logAction, type AuditActor } from "@/modules/audit/audit.service";

export async function getInventory(productId: string) {
  const inv = await InventoryModel.findOne({ productId }).lean();
  if (!inv) throw new AppError("Inventory record not found", 404);
  return inv;
}

export async function listInventory(filters: { lowStock?: boolean; page?: number; limit?: number } = {}) {
  const { lowStock, page = 1, limit = 50 } = filters;

  const pipeline: PipelineStage[] = [
    { $lookup: { from: "products", localField: "productId", foreignField: "_id", as: "product" } },
    { $unwind: "$product" },
    { $match: { "product.status": { $ne: "archived" } } },
  ];

  if (lowStock) {
    pipeline.push({ $match: { $expr: { $lte: ["$quantity", "$lowStockThreshold"] } } });
  }

  pipeline.push(
    { $sort: { quantity: 1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
  );

  return InventoryModel.aggregate(pipeline);
}

export async function getLowStockItems() {
  return InventoryModel.aggregate([
    { $match: { trackInventory: true } },
    { $addFields: { isLow: { $lte: ["$quantity", "$lowStockThreshold"] } } },
    { $match: { isLow: true } },
    { $lookup: { from: "products", localField: "productId", foreignField: "_id", as: "product" } },
    { $unwind: "$product" },
    { $match: { "product.status": "active" } },
    { $sort: { quantity: 1 } },
  ]);
}

export async function updateInventory(productId: string, data: Partial<{
  quantity: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  allowBackorder: boolean;
}>, actor?: AuditActor) {
  const before = await InventoryModel.findOne({ productId }).lean();
  if (!before) throw new AppError("Inventory record not found", 404);

  const inv = await InventoryModel.findOneAndUpdate({ productId }, data, { new: true });
  if (!inv) throw new AppError("Inventory record not found", 404);

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     "inventory.update",
    resource:   "inventory",
    resourceId: String(productId),
    before:     before as Record<string, unknown>,
    after:      inv.toObject() as unknown as Record<string, unknown>,
    ipAddress:  actor?.ip,
  });

  return inv;
}

export async function adjustStock(productId: string, delta: number, actor?: AuditActor) {
  const inv = await InventoryModel.findOne({ productId });
  if (!inv) throw new AppError("Inventory record not found", 404);

  const oldQty = inv.quantity;
  const newQty = oldQty + delta;
  if (newQty < 0) throw new AppError("Insufficient stock", 409);

  inv.quantity = newQty;
  const saved = await inv.save();

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     delta > 0 ? "inventory.stock_added" : "inventory.stock_removed",
    resource:   "inventory",
    resourceId: String(productId),
    before:     { quantity: oldQty },
    after:      { quantity: newQty },
    details:    { delta },
    ipAddress:  actor?.ip,
  });

  return saved;
}

/* Called during checkout — reduces stock, throws if insufficient */
export async function deductStock(items: Array<{ productId: string; quantity: number }>) {
  for (const { productId, quantity } of items) {
    const inv = await InventoryModel.findOne({ productId });
    if (!inv) continue;
    if (!inv.trackInventory) continue;
    if (!inv.allowBackorder && inv.quantity < quantity) {
      throw new AppError(`Insufficient stock for product`, 409);
    }
    await InventoryModel.findByIdAndUpdate(inv._id, { $inc: { quantity: -quantity } });
  }
}
