import { Router } from "express";
import { authenticate, optionalAuth, requirePermission } from "@/common/middleware/auth.middleware";
import * as ctrl from "./orders.controller";

const router = Router();

/* Checkout — optionalAuth (works for both guest + auth) */
router.post("/checkout", optionalAuth, ctrl.checkout);

/* Customer — authenticated */
router.get("/my",     authenticate, ctrl.myOrders);
router.get("/my/:id", authenticate, ctrl.myOrder);

/* Admin */
router.get(  "/admin",            authenticate, requirePermission("orders.read"),          ctrl.adminList);
router.get(  "/admin/:id",        authenticate, requirePermission("orders.read"),          ctrl.adminGet);
router.patch("/admin/:id/status", authenticate, requirePermission("orders.status.update"), ctrl.updateStatus);
router.post( "/admin/:id/notes",  authenticate, requirePermission("orders.update"),        ctrl.addNote);

export default router;
