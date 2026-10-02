import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import type { Request } from "express";
import * as svc from "./inventory.service";
import * as batchSvc from "./batch.service";

function actor(req: Request) {
  if (!req.user) return undefined;
  return { id: req.user._id, email: req.user.email, name: req.user.fullName, ip: req.ip };
}

const router = Router();

/* ─── Inventory (aggregate) ─────────────────────────────────────────────── */

router.get("/", authenticate, requirePermission("inventory.read"), asyncHandler(async (req, res) => {
  const { lowStock, page, limit } = z.object({
    lowStock: z.coerce.boolean().optional(),
    page:     z.coerce.number().int().min(1).optional(),
    limit:    z.coerce.number().int().min(1).max(100).optional(),
  }).parse(req.query);
  sendSuccess(res, await svc.listInventory({ lowStock, page, limit }));
}));

router.get("/low-stock", authenticate, requirePermission("inventory.read"), asyncHandler(async (_req, res) => {
  sendSuccess(res, await svc.getLowStockItems());
}));

router.get("/near-expiry", authenticate, requirePermission("inventory.read"), asyncHandler(async (req, res) => {
  const { days } = z.object({ days: z.coerce.number().int().min(1).max(365).optional() }).parse(req.query);
  sendSuccess(res, await batchSvc.getNearExpiryBatches(days));
}));

router.get("/movements", authenticate, requirePermission("inventory.movements.read"), asyncHandler(async (req, res) => {
  const { productId, movementType, page, limit } = z.object({
    productId:    z.string().optional(),
    movementType: z.string().optional(),
    page:         z.coerce.number().int().min(1).optional(),
    limit:        z.coerce.number().int().min(1).max(100).optional(),
  }).parse(req.query);
  sendSuccess(res, await batchSvc.getAllMovements({ productId, movementType, page, limit }));
}));

router.get("/:productId", authenticate, requirePermission("inventory.read"), asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getInventory(String(req.params.productId)));
}));

router.patch("/:productId", authenticate, requirePermission("inventory.adjust"), asyncHandler(async (req, res) => {
  const dto = z.object({
    quantity:             z.number().int().min(0).optional(),
    lowStockThreshold:    z.number().int().min(0).optional(),
    trackInventory:       z.boolean().optional(),
    allowBackorder:       z.boolean().optional(),
    batchTrackingEnabled: z.boolean().optional(),
    nearExpiryAlertDays:  z.number().int().min(1).max(365).optional(),
  }).parse(req.body);
  sendSuccess(res, await svc.updateInventory(String(req.params.productId), dto, actor(req)), "Inventory updated");
}));

router.post("/:productId/adjust", authenticate, requirePermission("inventory.adjust"), asyncHandler(async (req, res) => {
  const { delta } = z.object({ delta: z.number().int() }).parse(req.body);
  sendSuccess(res, await svc.adjustStock(String(req.params.productId), delta, actor(req)), "Stock adjusted");
}));

/* ─── Batches ────────────────────────────────────────────────────────────── */

router.get("/:productId/batches", authenticate, requirePermission("inventory.read"), asyncHandler(async (req, res) => {
  sendSuccess(res, await batchSvc.listBatches(String(req.params.productId)));
}));

router.post("/:productId/batches", authenticate, requirePermission("inventory.adjust"), asyncHandler(async (req, res) => {
  const a = actor(req)!;
  const dto = z.object({
    batchNumber:      z.string().min(1).max(100).trim(),
    expiryDate:       z.coerce.date(),
    manufacturedDate: z.coerce.date().nullable().optional(),
    initialQty:       z.number().int().min(1),
    supplier:         z.string().max(200).optional(),
    purchaseOrderRef: z.string().max(100).optional(),
    notes:            z.string().max(500).optional(),
  }).parse(req.body);

  const batch = await batchSvc.addBatch({ productId: String(req.params.productId), ...dto }, a);
  sendSuccess(res, batch, "Batch added", 201);
}));

router.get("/:productId/batches/:batchId", authenticate, requirePermission("inventory.read"), asyncHandler(async (req, res) => {
  sendSuccess(res, await batchSvc.getBatch(String(req.params.batchId)));
}));

router.patch("/:productId/batches/:batchId", authenticate, requirePermission("inventory.adjust"), asyncHandler(async (req, res) => {
  const dto = z.object({
    batchNumber:      z.string().min(1).max(100).trim().optional(),
    expiryDate:       z.string().datetime({ offset: true }).optional(),
    manufacturedDate: z.string().datetime({ offset: true }).nullable().optional(),
    supplier:         z.string().max(200).nullable().optional(),
    purchaseOrderRef: z.string().max(100).nullable().optional(),
    notes:            z.string().max(500).optional(),
  }).parse(req.body);
  sendSuccess(res, await batchSvc.updateBatch(String(req.params.productId), String(req.params.batchId), dto), "Batch updated");
}));

router.post("/:productId/batches/:batchId/recall", authenticate, requirePermission("inventory.batches.recall"), asyncHandler(async (req, res) => {
  const a = actor(req)!;
  const { reason } = z.object({ reason: z.string().min(5).max(500).trim() }).parse(req.body);
  sendSuccess(res, await batchSvc.recallBatch(String(req.params.batchId), reason, a), "Batch recalled");
}));

router.post("/:productId/batches/:batchId/adjust", authenticate, requirePermission("inventory.adjust"), asyncHandler(async (req, res) => {
  const a = actor(req)!;
  const { delta, reason } = z.object({
    delta:  z.number().int(),
    reason: z.string().min(3).max(500).trim(),
  }).parse(req.body);
  sendSuccess(res, await batchSvc.manualAdjustBatch(String(req.params.batchId), delta, reason, a), "Stock adjusted");
}));

router.get("/:productId/batches/:batchId/movements", authenticate, requirePermission("inventory.movements.read"), asyncHandler(async (req, res) => {
  const { page, limit } = z.object({
    page:  z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }).parse(req.query);
  sendSuccess(res, await batchSvc.getBatchMovements(String(req.params.batchId), page, limit));
}));

router.get("/:productId/movements", authenticate, requirePermission("inventory.movements.read"), asyncHandler(async (req, res) => {
  const { page, limit } = z.object({
    page:  z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }).parse(req.query);
  sendSuccess(res, await batchSvc.getProductMovements(String(req.params.productId), page, limit));
}));

export default router;
