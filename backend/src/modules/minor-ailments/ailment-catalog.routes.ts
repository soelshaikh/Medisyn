import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import type { Request } from "express";
import * as svc from "./ailment-catalog.service";
import type { IIntakeField } from "./ailment-catalog.schema";

function actor(req: Request) {
  if (!req.user) return undefined;
  return { id: req.user._id, email: req.user.email, name: req.user.fullName, ip: req.ip };
}

const IntakeFieldDto = z.object({
  label:       z.string().min(1).max(200),
  type:        z.enum(["text", "textarea", "select", "radio", "checkbox"]),
  options:     z.array(z.string()).default([]),
  placeholder: z.string().default(""),
  required:    z.boolean().default(false),
  sortOrder:   z.number().int().default(0),
});

const CreateDto = z.object({
  name:             z.string().min(1).max(100),
  description:      z.string().max(500).optional(),
  intakeFormFields: z.array(IntakeFieldDto).default([]),
  sortOrder:        z.number().int().optional(),
});

const router = Router();

/* Public — list active ailments (with form fields so frontend can render the form) */
router.get("/", asyncHandler(async (_req, res) => {
  sendSuccess(res, await svc.listPublicAilments());
}));

router.get("/:slug/public", asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getAilmentBySlug(String(req.params.slug)));
}));

/* Admin */
router.get("/admin/all", authenticate, requirePermission("content.ailments.read"),
  asyncHandler(async (_req, res) => sendSuccess(res, await svc.listAllAilments()))
);

router.post("/", authenticate, requirePermission("content.ailments.manage"),
  asyncHandler(async (req, res) => {
    const dto = CreateDto.parse(req.body);
    sendSuccess(res, await svc.createAilment(dto, actor(req)), "Ailment created", 201);
  })
);

router.patch("/:id", authenticate, requirePermission("content.ailments.manage"),
  asyncHandler(async (req, res) => {
    const dto = CreateDto.partial().parse(req.body);
    sendSuccess(res, await svc.updateAilment(String(req.params.id), dto, actor(req)), "Ailment updated");
  })
);

/* Dedicated endpoint for updating form fields + sequence */
router.put("/:id/fields", authenticate, requirePermission("content.ailments.manage"),
  asyncHandler(async (req, res) => {
    const { fields } = z.object({ fields: z.array(IntakeFieldDto) }).parse(req.body);
    sendSuccess(res, await svc.updateAilmentFields(String(req.params.id), fields as IIntakeField[], actor(req)), "Fields updated");
  })
);

router.delete("/:id", authenticate, requirePermission("content.ailments.manage"),
  asyncHandler(async (req, res) => {
    await svc.deleteAilment(String(req.params.id), actor(req));
    sendSuccess(res, null, "Ailment deleted");
  })
);

export default router;
