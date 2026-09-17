import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as authController from "./auth.controller";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests, please try again later", statusCode: 429 },
});

const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many password reset requests", statusCode: 429 },
});

router.post("/register",        authLimiter,   authController.register);
router.post("/login",           authLimiter,   authController.login);
router.post("/logout",                         authController.logout);
router.post("/refresh",                        authController.refresh);
router.post("/verify-email",    authLimiter,   authController.verifyEmail);
router.post("/forgot-password", forgotLimiter, authController.forgotPassword);
router.post("/reset-password",  authLimiter,   authController.resetPassword);

export default router;
