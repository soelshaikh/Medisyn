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
import clinicsRoutes     from "./modules/clinics/clinics.routes";
import partnersRoutes    from "./modules/partners/partners.routes";
import faqsRoutes        from "./modules/faqs/faqs.routes";
import auditRoutes       from "./modules/audit/audit.routes";
import dashboardRoutes   from "./modules/dashboard/dashboard.routes";
import categoriesRoutes  from "./modules/categories/categories.routes";
import productsRoutes    from "./modules/products/products.routes";
import inventoryRoutes   from "./modules/inventory/inventory.routes";
import couponsRoutes     from "./modules/coupons/coupons.routes";
import cartRoutes        from "./modules/cart/cart.routes";
import ordersRoutes      from "./modules/orders/orders.routes";

import ailmentCatalogRoutes  from "./modules/minor-ailments/ailment-catalog.routes";
import ailmentRequestRoutes  from "./modules/minor-ailments/ailment-request.routes";
import compoundingRoutes     from "./modules/compounding/compounding.routes";
import prescriptionsRoutes   from "./modules/prescriptions/prescriptions.routes";
import askPharmacistRoutes   from "./modules/ask-pharmacist/ask-pharmacist.routes";

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
app.use("/api/v1/auth",              authRoutes);
app.use("/api/v1/users",            usersRoutes);
app.use("/api/v1/admin/roles",      rolesRoutes);
app.use("/api/v1/admin/permissions",permissionsRoutes);

/* Phase 2 — Admin Management */
app.use("/api/v1/admin/clinics",    clinicsRoutes);
app.use("/api/v1/admin/partners",   partnersRoutes);
app.use("/api/v1/admin/faqs",       faqsRoutes);
app.use("/api/v1/faqs",             faqsRoutes);
app.use("/api/v1/admin/audit",      auditRoutes);
app.use("/api/v1/admin/dashboard",  dashboardRoutes);

/* Phase 3 — Ecommerce Catalogue */
app.use("/api/v1/categories", categoriesRoutes);
app.use("/api/v1/products",   productsRoutes);
app.use("/api/v1/admin/inventory", inventoryRoutes);
app.use("/api/v1/coupons",    couponsRoutes);

/* Phase 4 — Ecommerce Commerce */
app.use("/api/v1/cart",   cartRoutes);
app.use("/api/v1/orders", ordersRoutes);

/* Phase 5 — Healthcare Workflows */
app.use("/api/v1/ailments",         ailmentCatalogRoutes);
app.use("/api/v1/ailment-requests", ailmentRequestRoutes);
app.use("/api/v1/compounding",      compoundingRoutes);
app.use("/api/v1/prescriptions",    prescriptionsRoutes);
app.use("/api/v1/ask-pharmacist",   askPharmacistRoutes);

/* Serve product images */
app.use("/uploads", express.static("uploads"));

/* ── 404 ── */
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Route not found", statusCode: 404 });
});

/* ── Error handler ── */
app.use(errorMiddleware);
