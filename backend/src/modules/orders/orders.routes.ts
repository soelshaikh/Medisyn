import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate, optionalAuth, requirePermission } from "@/common/middleware/auth.middleware";
import { ecommerceMutationLimiter } from "@/common/middleware/rate-limit.middleware";
import * as ctrl from "./orders.controller";

const router = Router();

/* Public order tracking — 20 lookups / 15 min per IP */
const trackLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  skip:            () => process.env.NODE_ENV !== "production",
  message:         { success: false, error: "Too many tracking requests — please try again shortly", statusCode: 429 },
});
router.get("/track", trackLimiter, ctrl.trackOrder);

/* Checkout — optionalAuth (works for both guest + auth) */
router.post("/checkout", optionalAuth, ecommerceMutationLimiter, ctrl.checkout);

/* Customer — authenticated */
router.get(   "/my",              authenticate, ctrl.myOrders);
router.get(   "/my/:id",          authenticate, ctrl.myOrder);
router.patch( "/my/:id/cancel",   authenticate, ctrl.cancelMyOrder);

/* Admin */
router.get(  "/admin",            authenticate, requirePermission("orders.read"),          ctrl.adminList);
router.get(  "/admin/:id",        authenticate, requirePermission("orders.read"),          ctrl.adminGet);
router.patch("/admin/:id/status", authenticate, requirePermission("orders.status.update"), ctrl.updateStatus);
router.post( "/admin/:id/notes",  authenticate, requirePermission("orders.update"),        ctrl.addNote);

export default router;
