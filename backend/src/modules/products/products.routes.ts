import { Router } from "express";
import multer from "multer";
import path from "path";
import { v4 as uuid } from "uuid";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import * as ctrl from "./products.controller";

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(process.cwd(), "uploads")),
    filename:    (_req, file, cb) => cb(null, `${uuid()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

const router = Router();

/* Public */
router.get("/",          ctrl.list);
router.get("/:slug",     ctrl.getBySlug);

/* Admin */
router.get(   "/admin/all",          authenticate, requirePermission("products.read"),   ctrl.listAdmin);
router.get(   "/admin/:id",          authenticate, requirePermission("products.read"),   ctrl.getById);
router.post(  "/",                   authenticate, requirePermission("products.create"), ctrl.create);
router.patch( "/:id",                authenticate, requirePermission("products.update"), ctrl.update);
router.delete("/:id",                authenticate, requirePermission("products.delete"), ctrl.archive);
router.post(  "/:id/images",         authenticate, requirePermission("products.update"), upload.single("image"), ctrl.addImage);
router.delete("/:id/images",         authenticate, requirePermission("products.update"), ctrl.removeImage);

export default router;
