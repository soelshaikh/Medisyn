import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config";
import { requestIdMiddleware } from "./common/middleware/requestId.middleware";
import { errorMiddleware } from "./common/middleware/error.middleware";
import { logger } from "./common/utils/logger";

import authRoutes        from "./modules/auth/auth.routes";
import usersRoutes       from "./modules/users/users.routes";
import rolesRoutes       from "./modules/roles/roles.routes";
import permissionsRoutes from "./modules/permissions/permissions.routes";

export const app = express();

/* ── Security ── */
app.use(helmet());
app.use(cors({
  origin: [config.FRONTEND_URL, config.ADMIN_URL],
  credentials: true,
}));

/* ── Parsing ── */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ── Request ID ── */
app.use(requestIdMiddleware);

/* ── Request logging ── */
app.use((req, _res, next) => {
  logger.info("Request", { method: req.method, path: req.path, requestId: req.requestId });
  next();
});

/* ── Health ── */
app.get("/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok", timestamp: new Date().toISOString() } });
});

/* ── API Routes ── */
app.use("/api/v1/auth",        authRoutes);
app.use("/api/v1/users",       usersRoutes);
app.use("/api/v1/admin/roles",       rolesRoutes);
app.use("/api/v1/admin/permissions", permissionsRoutes);

/* ── 404 ── */
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Route not found", statusCode: 404 });
});

/* ── Error handler ── */
app.use(errorMiddleware);
