import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import type { Request } from "express";
import * as svc from "./inventory.service";

function actor(req: Request) {
  if (!req.user) return undefined;
  return { id: req.user._id, email: req.user.email, name: req.user.fullName, ip: req.ip };
}

const router = Router();

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

router.get("/:productId", authenticate, requirePermission("inventory.read"), asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getInventory(String(req.params.productId)));
}));

router.patch("/:productId", authenticate, requirePermission("inventory.adjust"), asyncHandler(async (req, res) => {
  const dto = z.object({
    quantity:          z.number().int().min(0).optional(),
    lowStockThreshold: z.number().int().min(0).optional(),
    trackInventory:    z.boolean().optional(),
    allowBackorder:    z.boolean().optional(),
  }).parse(req.body);
  sendSuccess(res, await svc.updateInventory(String(req.params.productId), dto, actor(req)), "Inventory updated");
}));

router.post("/:productId/adjust", authenticate, requirePermission("inventory.adjust"), asyncHandler(async (req, res) => {
  const { delta } = z.object({ delta: z.number().int() }).parse(req.body);
  sendSuccess(res, await svc.adjustStock(String(req.params.productId), delta, actor(req)), "Stock adjusted");
}));

export default router;
