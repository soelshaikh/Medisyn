import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import type { Request } from "express";
import * as svc from "./faqs.service";

const FAQDto = z.object({
  question:    z.string().min(1).max(500),
  answer:      z.string().min(1),
  category:    z.string().max(80).optional(),
  sortOrder:   z.number().int().optional(),
  isPublished: z.boolean().optional(),
});

function actor(req: Request) {
  if (!req.user) return undefined;
  return { id: req.user._id, email: req.user.email, name: req.user.fullName, ip: req.ip };
}

const router = Router();

/* Public */
router.get("/public",      asyncHandler(async (_req, res) => sendSuccess(res, await svc.listPublicFAQs())));
router.get("/categories",  asyncHandler(async (_req, res) => sendSuccess(res, await svc.getFAQCategories())));

/* Admin */
router.get("/", authenticate, requirePermission("content.faqs.read"), asyncHandler(async (req, res) => {
  const { category, page, limit } = z.object({
    category: z.string().optional(),
    page:     z.coerce.number().int().min(1).optional(),
    limit:    z.coerce.number().int().min(1).max(200).optional(),
  }).parse(req.query);
  sendSuccess(res, await svc.listAllFAQs({ category, page, limit }));
}));

router.post("/", authenticate, requirePermission("content.faqs.manage"), asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.createFAQ(FAQDto.parse(req.body), actor(req)), "FAQ created", 201);
}));

router.patch("/reorder", authenticate, requirePermission("content.faqs.manage"), asyncHandler(async (req, res) => {
  const { items } = z.object({
    items: z.array(z.object({ id: z.string(), sortOrder: z.number().int() })),
  }).parse(req.body);
  await svc.reorderFAQs(items);
  sendSuccess(res, null, "FAQs reordered");
}));

router.patch("/:id", authenticate, requirePermission("content.faqs.manage"), asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.updateFAQ(String(req.params.id), FAQDto.partial().parse(req.body), actor(req)), "FAQ updated");
}));

router.delete("/:id", authenticate, requirePermission("content.faqs.manage"), asyncHandler(async (req, res) => {
  await svc.deleteFAQ(String(req.params.id), actor(req));
  sendSuccess(res, null, "FAQ deleted");
}));

export default router;
