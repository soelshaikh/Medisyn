import { Router } from "express";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import * as ctrl from "./brands.controller";

const router = Router();

/* Public */
router.get("/",       ctrl.list);
router.get("/:slug",  ctrl.getBySlug);

/* Admin */
router.get(   "/admin/all",  authenticate, requirePermission("products.read"),   ctrl.listAdmin);
router.get(   "/admin/:id",  authenticate, requirePermission("products.read"),   ctrl.getById);
router.post(  "/",           authenticate, requirePermission("products.create"), ctrl.create);
router.patch( "/:id",        authenticate, requirePermission("products.update"), ctrl.update);
router.delete("/:id",        authenticate, requirePermission("products.delete"), ctrl.remove);

export default router;
