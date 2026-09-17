import { Router } from "express";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import * as rolesController from "./roles.controller";

const router = Router();

router.use(authenticate);

router.get("/",                requirePermission("roles.read"),   rolesController.list);
router.get("/:id",             requirePermission("roles.read"),   rolesController.getById);
router.post("/",               requirePermission("roles.create"), rolesController.create);
router.patch("/:id",           requirePermission("roles.update"), rolesController.update);
router.delete("/:id",          requirePermission("roles.delete"), rolesController.remove);
router.put("/:id/permissions", requirePermission("roles.update"), rolesController.setPermissions);

export default router;
