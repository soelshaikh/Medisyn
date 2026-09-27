import express from "express";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import mongoSanitize from "express-mongo-sanitize";
import swaggerUi from "swagger-ui-express";
import { config } from "./config";
import { requestIdMiddleware } from "./common/middleware/requestId.middleware";
import { errorMiddleware } from "./common/middleware/error.middleware";
import { globalApiLimiter } from "./common/middleware/rate-limit.middleware";
import { logger } from "./common/utils/logger";
import { openapiSpec } from "./docs/openapi";

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
import brandsRoutes      from "./modules/brands/brands.routes";
import productsRoutes    from "./modules/products/products.routes";
import inventoryRoutes   from "./modules/inventory/inventory.routes";
import couponsRoutes     from "./modules/coupons/coupons.routes";
import cartRoutes        from "./modules/cart/cart.routes";
import ordersRoutes      from "./modules/orders/orders.routes";

import ailmentCatalogRoutes  from "./modules/minor-ailments/ailment-catalog.routes";
import ailmentRequestRoutes  from "./modules/minor-ailments/ailment-request.routes";
import compoundingRoutes     from "./modules/compounding/compounding.routes";
import prescriptionsRoutes   from "./modules/prescriptions/prescriptions.routes";
import askPharmacistRoutes        from "./modules/ask-pharmacist/ask-pharmacist.routes";
import askPharmacistTopicsRoutes  from "./modules/ask-pharmacist/ask-pharmacist-topics.routes";

import vaccineServicesRoutes        from "./modules/vaccine-services/vaccine-services.routes";
import appointmentSlotsRoutes       from "./modules/appointment-slots/appointment-slots.routes";
import appointmentsRoutes           from "./modules/appointments/appointments.routes";
import appointmentInterestRoutes    from "./modules/appointments/appointment-interest.routes";
import notificationsRoutes     from "./modules/notifications/notifications.routes";
import reportsRoutes           from "./modules/reports/reports.routes";
import filesRoutes             from "./modules/files/files.routes";
import settingsRoutes          from "./modules/settings/settings.routes";

export const app = express();

/* ── Security headers ── */
app.use(helmet({
  /* Allow cross-origin image loading (admin/frontend load images from backend origin) */
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cors({
  origin:      [config.FRONTEND_URL, config.ADMIN_URL],
  credentials: true,
}));

/* ── Local file uploads (dev only — production uses S3) ── */
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/* ── Compression ── */
app.use(compression());

/* ── Parsing ── (1 MB limit — files go through multer memoryStorage, not JSON body) */
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

/* ── MongoDB injection sanitization — strips $ and . from req.body, query, params ── */
app.use(mongoSanitize({ replaceWith: "_" }));

/* ── Request ID ── */
app.use(requestIdMiddleware);

/* ── Request logging (mask sensitive headers) ── */
app.use((req, _res, next) => {
  logger.info("Request", {
    method:    req.method,
    path:      req.path,
    requestId: req.requestId,
    ip:        req.ip,
    /* Intentionally omitting: Authorization value, Cookie content */
  });
  next();
});

/* ── Health (no rate limit) ── */
app.get("/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok", timestamp: new Date().toISOString() } });
});

/* ── API Docs ── */
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec, {
  customSiteTitle: "MediSyn API Docs",
  swaggerOptions:  { persistAuthorization: true },
}));

/* ── Global rate limit on all /api/v1 routes ── */
app.use("/api/v1", globalApiLimiter);

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
app.use("/api/v1/brands",     brandsRoutes);
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
app.use("/api/v1/ask-pharmacist",         askPharmacistRoutes);
app.use("/api/v1/ask-pharmacist-topics",  askPharmacistTopicsRoutes);

/* Phase 6 — Appointments */
app.use("/api/v1/vaccine-services",        vaccineServicesRoutes);
app.use("/api/v1/appointment-slots",       appointmentSlotsRoutes);
app.use("/api/v1/appointments",            appointmentsRoutes);
app.use("/api/v1/appointment-interest",    appointmentInterestRoutes);

/* Phase 7 — Notifications */
app.use("/api/v1/notifications", notificationsRoutes);

/* Phase 8 — Reports */
app.use("/api/v1/admin/reports", reportsRoutes);

/* Phase 9 — File Storage */
app.use("/api/v1/files", filesRoutes);

/* Pharmacy Settings */
app.use("/api/v1/settings", settingsRoutes);

/* Serve local uploads in development (no-op in production when using S3) */
app.use("/uploads", express.static("uploads"));

/* ── 404 ── */
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Route not found", statusCode: 404 });
});

/* ── Error handler ── */
app.use(errorMiddleware);
