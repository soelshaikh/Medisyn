import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as authController from "./auth.controller";

const router = Router();
const IS_DEV = process.env.NODE_ENV !== "production";

const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { success: false, error: "Too many requests, please try again later", statusCode: 429 },
  skip:            () => IS_DEV,
});

const forgotLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { success: false, error: "Too many password reset requests", statusCode: 429 },
  skip:            () => IS_DEV,
});

router.post("/register",        authLimiter,   authController.register);
router.post("/login",           authLimiter,   authController.login);
router.post("/logout",                         authController.logout);
router.post("/refresh",                        authController.refresh);
router.post("/verify-email",    authLimiter,   authController.verifyEmail);
router.post("/forgot-password", forgotLimiter, authController.forgotPassword);
router.post("/reset-password",  authLimiter,   authController.resetPassword);
/* CASL — no auth required so anyone with an email can unsubscribe */
router.post("/unsubscribe",     authLimiter,   authController.unsubscribeMarketing);

export default router;
