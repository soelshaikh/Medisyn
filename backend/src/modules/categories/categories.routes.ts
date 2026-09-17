import { Router } from "express";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import * as ctrl from "./categories.controller";

const router = Router();

/* Public */
router.get("/", ctrl.list);

/* Admin */
router.get(   "/admin/all", authenticate, requirePermission("categories.read"),   ctrl.listAdmin);
router.post(  "/",          authenticate, requirePermission("categories.create"), ctrl.create);
router.patch( "/:id",       authenticate, requirePermission("categories.update"), ctrl.update);
router.delete("/:id",       authenticate, requirePermission("categories.delete"), ctrl.remove);

export default router;
