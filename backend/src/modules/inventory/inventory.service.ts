import type { PipelineStage } from "mongoose";
import { InventoryModel } from "./inventory.schema";
import { AppError } from "@/common/middleware/error.middleware";

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
}>) {
  const inv = await InventoryModel.findOneAndUpdate({ productId }, data, { new: true });
  if (!inv) throw new AppError("Inventory record not found", 404);
  return inv;
}

export async function adjustStock(productId: string, delta: number) {
  const inv = await InventoryModel.findOne({ productId });
  if (!inv) throw new AppError("Inventory record not found", 404);
  const newQty = inv.quantity + delta;
  if (newQty < 0) throw new AppError("Insufficient stock", 409);
  inv.quantity = newQty;
  return inv.save();
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
