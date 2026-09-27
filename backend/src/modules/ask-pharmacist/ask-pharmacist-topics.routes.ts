import { Router } from "express";
import { z } from "zod";
import slugify from "slugify";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import { AppError } from "@/common/middleware/error.middleware";
import { AskPharmacistTopicModel } from "./ask-pharmacist-topics.schema";

const router = Router();

const TopicDto = z.object({
  name:      z.string().min(1).max(150),
  isActive:  z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

/* Public — list active topics for patient form */
router.get("/", asyncHandler(async (_req, res) => {
  const topics = await AskPharmacistTopicModel
    .find({ isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .select("name slug sortOrder")
    .lean();
  sendSuccess(res, topics);
}));

/* Admin — list all (including inactive) */
router.get("/admin/all", authenticate, requirePermission("ask-pharmacist.topics.manage"), asyncHandler(async (_req, res) => {
  const topics = await AskPharmacistTopicModel
    .find()
    .sort({ sortOrder: 1, name: 1 })
    .lean();
  sendSuccess(res, topics);
}));

/* Admin — batch sort-order */
router.patch("/sort-order", authenticate, requirePermission("ask-pharmacist.topics.manage"), asyncHandler(async (req, res) => {
  const { items } = z.object({
    items: z.array(z.object({ id: z.string(), sortOrder: z.number().int() })),
  }).parse(req.body);
  await Promise.all(items.map(({ id, sortOrder }) =>
    AskPharmacistTopicModel.updateOne({ _id: id }, { $set: { sortOrder } })
  ));
  sendSuccess(res, null, "Order saved");
}));

/* Admin — create */
router.post("/", authenticate, requirePermission("ask-pharmacist.topics.manage"), asyncHandler(async (req, res) => {
  const data = TopicDto.parse(req.body);
  const slug = slugify(data.name, { lower: true, strict: true });
  const exists = await AskPharmacistTopicModel.findOne({ slug });
  if (exists) throw new AppError("Topic with this name already exists", 409);
  const topic = await AskPharmacistTopicModel.create({ ...data, slug });
  sendSuccess(res, topic, "Topic created", 201);
}));

/* Admin — update */
router.patch("/:id", authenticate, requirePermission("ask-pharmacist.topics.manage"), asyncHandler(async (req, res) => {
  const data = TopicDto.partial().parse(req.body);
  const update: Record<string, unknown> = { ...data };
  if (data.name) update.slug = slugify(data.name, { lower: true, strict: true });
  const topic = await AskPharmacistTopicModel.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!topic) throw new AppError("Topic not found", 404);
  sendSuccess(res, topic, "Topic updated");
}));

/* Admin — delete */
router.delete("/:id", authenticate, requirePermission("ask-pharmacist.topics.manage"), asyncHandler(async (req, res) => {
  const topic = await AskPharmacistTopicModel.findByIdAndDelete(req.params.id);
  if (!topic) throw new AppError("Topic not found", 404);
  sendSuccess(res, null, "Topic deleted");
}));

export default router;
