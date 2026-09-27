import { Router } from "express";
import { authenticate } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import * as svc from "./notifications.service";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(50, Number(req.query.limit) || 20);
    sendSuccess(res, await svc.listNotifications(String(req.user!._id), page, limit));
  }),
);

router.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    const count = await svc.getUnreadCount(String(req.user!._id));
    sendSuccess(res, { count });
  }),
);

router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    sendSuccess(res, await svc.markOneRead(String(req.params.id), String(req.user!._id)));
  }),
);

router.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    sendSuccess(res, await svc.markAllRead(String(req.user!._id)));
  }),
);

export default router;
