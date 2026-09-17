import { Router } from "express";
import { authenticate, optionalAuth, requirePermission } from "@/common/middleware/auth.middleware";
import * as ctrl from "./coupons.controller";

const router = Router();

/* Public (optionalAuth for user-specific validation) */
router.get("/:code/validate", optionalAuth, ctrl.validate);

/* Admin */
router.get(   "/", authenticate, requirePermission("coupons.read"),   ctrl.list);
router.post(  "/", authenticate, requirePermission("coupons.create"), ctrl.create);
router.patch( "/:id", authenticate, requirePermission("coupons.update"), ctrl.update);
router.delete("/:id", authenticate, requirePermission("coupons.delete"), ctrl.remove);

export default router;
