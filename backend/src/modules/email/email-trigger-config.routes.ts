import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import { EmailTriggerService } from "./email-trigger.service";

const router = Router();
router.use(authenticate);

router.get("/", requirePermission("email-triggers.read"), asyncHandler(async (req, res) => {
  const { module } = z.object({ module: z.string().optional() }).parse(req.query);
  sendSuccess(res, await EmailTriggerService.list(module));
}));

router.patch("/:id", requirePermission("email-triggers.update"), asyncHandler(async (req, res) => {
  const { enabled, recipientTypes } = z.object({
    enabled:        z.boolean().optional(),
    recipientTypes: z.array(z.enum(["customer","assigned_staff","admin_team"])).optional(),
  }).parse(req.body);
  const updated = await EmailTriggerService.update(
    String(req.params.id),
    { enabled, recipientTypes },
    req.user!._id,
  );
  if (!updated) throw { statusCode: 404, message: "Trigger config not found" };
  sendSuccess(res, updated, "Email trigger updated");
}));

export default router;
