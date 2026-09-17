import { Router } from "express";
import { authenticate, optionalAuth } from "@/common/middleware/auth.middleware";
import * as ctrl from "./cart.controller";

const router = Router();

router.get(   "/",                 optionalAuth, ctrl.getCart);
router.post(  "/items",            optionalAuth, ctrl.addItem);
router.patch( "/items/:productId", optionalAuth, ctrl.updateItem);
router.delete("/items/:productId", optionalAuth, ctrl.removeItem);
router.post(  "/coupon",           optionalAuth, ctrl.applyCoupon);
router.delete("/coupon",           optionalAuth, ctrl.removeCoupon);
router.post(  "/merge",            authenticate, ctrl.mergeCart);

export default router;
