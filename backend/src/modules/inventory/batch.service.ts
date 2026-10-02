import mongoose from "mongoose";
import { ProductBatchModel, type IProductBatch } from "./productBatch.schema";
import { InventoryMovementModel, type MovementType } from "./inventoryMovement.schema";
import { InventoryModel } from "./inventory.schema";
import { AppError } from "@/common/middleware/error.middleware";
import type { AuditActor } from "@/modules/audit/audit.service";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface BatchAllocation {
  productId:   string;
  productName: string;
  batchId:     string;
  batchNumber: string;
  expiryDate:  Date;
  allocatedQty: number;
}

/* ─── Internal helpers ───────────────────────────────────────────────────── */

async function recordMovement(opts: {
  productId:    string;
  batch:        IProductBatch;
  type:         MovementType;
  qty:          number;
  qtyBefore:    number;
  qtyAfter:     number;
  orderId?:     string | null;
  orderNumber?: string | null;
  performedBy?: string | null;
  notes?:       string;
}) {
  await InventoryMovementModel.create({
    productId:    opts.productId,
    batchId:      opts.batch._id,
    batchNumber:  opts.batch.batchNumber,
    movementType: opts.type,
    qty:          opts.qty,
    qtyBefore:    opts.qtyBefore,
    qtyAfter:     opts.qtyAfter,
    orderId:      opts.orderId ?? null,
    orderNumber:  opts.orderNumber ?? null,
    performedBy:  opts.performedBy ?? null,
    notes:        opts.notes ?? "",
  });
}

/* Recompute and persist inventory.quantity from sum of active batch currentQty */
async function syncAggregateStock(productId: string) {
  const result = await ProductBatchModel.aggregate<{ total: number }>([
    { $match: { productId: new mongoose.Types.ObjectId(productId), status: "active" } },
    { $group: { _id: null, total: { $sum: "$currentQty" } } },
  ]);
  const total = result[0]?.total ?? 0;
  await InventoryModel.findOneAndUpdate({ productId }, { quantity: total });
}

/* ─── FEFO allocation ────────────────────────────────────────────────────── */

/**
 * Pure FEFO allocator — finds batches to fulfil requiredQty.
 * Sorted: earliest expiryDate first, then earliest receivedDate (FIFO tiebreaker).
 * Throws if stock is insufficient across all active, non-expired batches.
 */
export async function fefoAllocate(
  productId: string,
  productName: string,
  requiredQty: number,
): Promise<BatchAllocation[]> {
  const now = new Date();
  const batches = await ProductBatchModel.find({
    productId,
    status: "active",
    expiryDate: { $gt: now },
    currentQty: { $gt: 0 },
  }).sort({ expiryDate: 1, receivedDate: 1 });

  const allocations: BatchAllocation[] = [];
  let remaining = requiredQty;

  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.currentQty, remaining);
    allocations.push({
      productId,
      productName,
      batchId:      String(batch._id),
      batchNumber:  batch.batchNumber,
      expiryDate:   batch.expiryDate,
      allocatedQty: take,
    });
    remaining -= take;
  }

  if (remaining > 0) {
    const available = requiredQty - remaining;
    throw new AppError(
      `Insufficient batch stock: need ${requiredQty}, only ${available} available in non-expired batches`,
      409,
    );
  }

  return allocations;
}

/**
 * Deducts currentQty from batches according to FEFO allocation.
 * Called at checkout time for products with batch tracking enabled.
 * Returns the allocations for storing on the order document.
 */
export async function deductBatchStock(
  productId: string,
  productName: string,
  requiredQty: number,
  orderId?: string,
  orderNumber?: string,
): Promise<BatchAllocation[]> {
  const allocations = await fefoAllocate(productId, productName, requiredQty);

  for (const alloc of allocations) {
    const batch = await ProductBatchModel.findById(alloc.batchId);
    if (!batch) throw new AppError("Batch not found during deduction", 500);

    const qtyBefore = batch.currentQty;
    const qtyAfter  = qtyBefore - alloc.allocatedQty;

    batch.currentQty = qtyAfter;
    if (batch.currentQty === 0) batch.status = "depleted";
    await batch.save();

    await recordMovement({
      productId,
      batch,
      type:        "order_fulfilled",
      qty:         -alloc.allocatedQty,
      qtyBefore,
      qtyAfter,
      orderId,
      orderNumber,
    });
  }

  await syncAggregateStock(productId);
  return allocations;
}

/**
 * Restores currentQty to batches when an order is cancelled.
 * Called by orders.service restoreStock path for batch-tracked products.
 */
export async function restoreBatchStock(
  allocations: BatchAllocation[],
  orderId?: string,
  orderNumber?: string,
): Promise<void> {
  for (const alloc of allocations) {
    const batch = await ProductBatchModel.findById(alloc.batchId);
    if (!batch) continue; // batch recalled/deleted — skip silently

    const qtyBefore = batch.currentQty;
    const qtyAfter  = qtyBefore + alloc.allocatedQty;

    batch.currentQty = qtyAfter;
    /* Restore status if it was auto-depleted */
    if (batch.status === "depleted") batch.status = "active";
    await batch.save();

    await recordMovement({
      productId:   String(alloc.productId),
      batch,
      type:        "order_cancelled",
      qty:         alloc.allocatedQty,
      qtyBefore,
      qtyAfter,
      orderId,
      orderNumber,
    });
  }

  /* Re-sync each product's aggregate stock */
  const productIds = [...new Set(allocations.map((a) => String(a.productId)))];
  for (const pid of productIds) {
    await syncAggregateStock(pid);
  }
}

/* ─── Batch CRUD ─────────────────────────────────────────────────────────── */

export interface AddBatchInput {
  productId:        string;
  batchNumber:      string;
  expiryDate:       Date;
  manufacturedDate?: Date | null;
  initialQty:       number;
  supplier?:        string;
  purchaseOrderRef?: string;
  notes?:           string;
}

export async function addBatch(input: AddBatchInput, actor: AuditActor) {
  const inv = await InventoryModel.findOne({ productId: input.productId });
  if (!inv) throw new AppError("Inventory record not found for this product", 404);
  if (!inv.batchTrackingEnabled) {
    throw new AppError("Batch tracking is not enabled for this product", 400);
  }

  /* Duplicate batch number guard */
  const exists = await ProductBatchModel.findOne({
    productId: input.productId,
    batchNumber: input.batchNumber,
  });
  if (exists) throw new AppError(`Batch number "${input.batchNumber}" already exists for this product`, 409);

  const batch = await ProductBatchModel.create({
    productId:        input.productId,
    batchNumber:      input.batchNumber,
    expiryDate:       input.expiryDate,
    manufacturedDate: input.manufacturedDate ?? null,
    initialQty:       input.initialQty,
    currentQty:       input.initialQty,
    supplier:         input.supplier ?? null,
    purchaseOrderRef: input.purchaseOrderRef ?? null,
    notes:            input.notes ?? "",
    createdBy:        actor.id,
  });

  await recordMovement({
    productId:   input.productId,
    batch,
    type:        "batch_received",
    qty:         input.initialQty,
    qtyBefore:   0,
    qtyAfter:    input.initialQty,
    performedBy: actor.id,
    notes:       `Batch received. Supplier: ${input.supplier ?? "—"}`,
  });

  await syncAggregateStock(input.productId);
  return batch;
}

export async function listBatches(productId: string) {
  return ProductBatchModel.find({ productId }).sort({ expiryDate: 1, receivedDate: 1 }).lean();
}

export async function getBatch(batchId: string) {
  const batch = await ProductBatchModel.findById(batchId).lean();
  if (!batch) throw new AppError("Batch not found", 404);
  return batch;
}

export async function updateBatch(
  productId: string,
  batchId: string,
  updates: {
    batchNumber?:      string;
    expiryDate?:       string;
    manufacturedDate?: string | null;
    supplier?:         string | null;
    purchaseOrderRef?: string | null;
    notes?:            string;
  },
) {
  /* If batchNumber is changing, ensure it stays unique within the product */
  if (updates.batchNumber) {
    const conflict = await ProductBatchModel.findOne({
      productId,
      batchNumber: updates.batchNumber,
      _id: { $ne: batchId },
    }).lean();
    if (conflict) throw new AppError("A batch with that number already exists for this product", 409);
  }

  const payload: Record<string, unknown> = { ...updates };
  if (updates.expiryDate)       payload.expiryDate       = new Date(updates.expiryDate);
  if (updates.manufacturedDate) payload.manufacturedDate = new Date(updates.manufacturedDate);
  if (updates.manufacturedDate === null) payload.manufacturedDate = null;

  const batch = await ProductBatchModel.findByIdAndUpdate(batchId, payload, { new: true });
  if (!batch) throw new AppError("Batch not found", 404);
  return batch;
}

/** @deprecated use updateBatch */
export async function updateBatchNotes(
  batchId: string,
  updates: { notes?: string; supplier?: string; purchaseOrderRef?: string },
) {
  return updateBatch("", batchId, updates);
}

export async function recallBatch(batchId: string, reason: string, actor: AuditActor) {
  const batch = await ProductBatchModel.findById(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  if (batch.status === "recalled") throw new AppError("Batch is already recalled", 409);

  const qtyBefore = batch.currentQty;
  batch.status      = "recalled";
  batch.recallReason = reason;
  batch.recalledAt  = new Date();
  batch.recalledBy  = actor.id as unknown as import("mongoose").Types.ObjectId;
  const qtyRemoved  = batch.currentQty;
  batch.currentQty  = 0;
  await batch.save();

  if (qtyRemoved > 0) {
    await recordMovement({
      productId:   String(batch.productId),
      batch,
      type:        "batch_recalled",
      qty:         -qtyRemoved,
      qtyBefore,
      qtyAfter:    0,
      performedBy: actor.id,
      notes:       `Recalled: ${reason}`,
    });
    await syncAggregateStock(String(batch.productId));
  }

  return batch;
}

export async function manualAdjustBatch(
  batchId: string,
  delta: number,
  reason: string,
  actor: AuditActor,
) {
  if (delta === 0) throw new AppError("Adjustment delta cannot be zero", 400);

  const batch = await ProductBatchModel.findById(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  if (batch.status === "recalled") throw new AppError("Cannot adjust a recalled batch", 400);

  const qtyBefore = batch.currentQty;
  const qtyAfter  = qtyBefore + delta;
  if (qtyAfter < 0) throw new AppError("Adjustment would result in negative stock", 409);

  batch.currentQty = qtyAfter;
  if (batch.currentQty === 0) batch.status = "depleted";
  if (batch.currentQty > 0 && batch.status === "depleted") batch.status = "active";
  await batch.save();

  await recordMovement({
    productId:   String(batch.productId),
    batch,
    type:        "manual_adjustment",
    qty:         delta,
    qtyBefore,
    qtyAfter,
    performedBy: actor.id,
    notes:       reason,
  });

  await syncAggregateStock(String(batch.productId));
  return batch;
}

export async function getBatchMovements(batchId: string, page = 1, limit = 50) {
  const [total, data] = await Promise.all([
    InventoryMovementModel.countDocuments({ batchId }),
    InventoryMovementModel.find({ batchId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);
  return { data, total, page, limit };
}

export async function getProductMovements(productId: string, page = 1, limit = 50) {
  const [total, data] = await Promise.all([
    InventoryMovementModel.countDocuments({ productId }),
    InventoryMovementModel.find({ productId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);
  return { data, total, page, limit };
}

/* ─── Near-expiry alerts ─────────────────────────────────────────────────── */

export async function getNearExpiryBatches(limitDays?: number) {
  const inv = await InventoryModel.find({ batchTrackingEnabled: true }).lean();
  const defaultDays = 90;

  const pipeline = inv.map((i) => ({
    productId: i.productId,
    days: i.nearExpiryAlertDays ?? defaultDays,
  }));

  if (pipeline.length === 0) return [];

  const now = new Date();
  const alertDate = new Date(now);
  alertDate.setDate(alertDate.getDate() + (limitDays ?? defaultDays));

  return ProductBatchModel.aggregate([
    {
      $match: {
        status: "active",
        currentQty: { $gt: 0 },
        expiryDate: { $gt: now, $lte: alertDate },
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "productId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    {
      $addFields: {
        daysUntilExpiry: {
          $divide: [
            { $subtract: ["$expiryDate", now] },
            1000 * 60 * 60 * 24,
          ],
        },
      },
    },
    { $sort: { expiryDate: 1 } },
  ]);
}

export async function getAllMovements(filters: {
  productId?: string;
  movementType?: string;
  page?: number;
  limit?: number;
}) {
  const { productId, movementType, page = 1, limit = 50 } = filters;
  const query: Record<string, unknown> = {};
  if (productId)    query.productId = productId;
  if (movementType) query.movementType = movementType;

  const [total, data] = await Promise.all([
    InventoryMovementModel.countDocuments(query),
    InventoryMovementModel.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);
  return { data, total, page, limit };
}
