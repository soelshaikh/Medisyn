import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import { queryAuditLog } from "./audit.service";

const router = Router();

router.get("/", authenticate, requirePermission("audit.read"), asyncHandler(async (req, res) => {
  const filters = z.object({
    userId:   z.string().optional(),
    resource: z.string().optional(),
    action:   z.string().optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo:   z.coerce.date().optional(),
    page:     z.coerce.number().int().min(1).optional(),
    limit:    z.coerce.number().int().min(1).max(200).optional(),
  }).parse(req.query);

  sendSuccess(res, await queryAuditLog(filters));
}));

export default router;
