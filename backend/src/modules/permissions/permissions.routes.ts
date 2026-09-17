import { Router } from "express";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import { PermissionModel } from "./permissions.schema";

const router = Router();
router.use(authenticate);

router.get("/", requirePermission("permissions.read"), asyncHandler(async (_req, res) => {
  const permissions = await PermissionModel.find().sort({ group: 1, key: 1 }).lean();
  sendSuccess(res, permissions);
}));

export default router;
