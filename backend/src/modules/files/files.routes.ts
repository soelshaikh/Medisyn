import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { authenticate } from "@/common/middleware/auth.middleware";
import { uploadLimiter } from "@/common/middleware/rate-limit.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import { AppError } from "@/common/middleware/error.middleware";
import { storageService } from "./file-storage.service";

const router = Router();

/* ── Upload types ── */
type UploadType = "product-image" | "document";

const UPLOAD_CONFIG: Record<UploadType, {
  maxSize:      number;
  mimeTypes:    string[];
  folder:       string;
  isPrivate:    boolean;
}> = {
  "product-image": {
    maxSize:   5 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    folder:    "products",
    isPrivate: false,
  },
  "document": {
    maxSize:   20 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    folder:    "private/documents",
    isPrivate: true,
  },
};

/* multer memoryStorage — provider handles persistence */
const memUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 }, /* 20 MB hard cap */
});

/* ────────────────────────────────────────────────────────────────────
   POST /api/v1/files/upload
   Body: multipart form-data — field "file", query ?type=product-image|document
   Returns: { key, url }
   ──────────────────────────────────────────────────────────────────── */
router.post(
  "/upload",
  authenticate,
  uploadLimiter,
  memUpload.single("file"),
  asyncHandler(async (req, res) => {
    const { type = "document" } = z
      .object({ type: z.enum(["product-image", "document"]).default("document") })
      .parse(req.query);

    if (!req.file) throw new AppError("No file uploaded", 400);

    const cfg = UPLOAD_CONFIG[type];

    if (req.file.size > cfg.maxSize) {
      throw new AppError(`File too large (max ${cfg.maxSize / 1024 / 1024} MB)`, 400);
    }
    if (!cfg.mimeTypes.includes(req.file.mimetype)) {
      throw new AppError(`Invalid file type. Allowed: ${cfg.mimeTypes.join(", ")}`, 400);
    }

    const folder = cfg.isPrivate
      ? `private/${type.replace("product-image", "products")}`
      : cfg.folder;

    const result = await storageService.upload({
      buffer:       req.file.buffer,
      originalName: req.file.originalname,
      mimeType:     req.file.mimetype,
      folder,
    });

    sendSuccess(res, result, "File uploaded");
  }),
);

/* ────────────────────────────────────────────────────────────────────
   GET /api/v1/files/signed-url?key=...
   Returns a temporary (1-hour) presigned URL for private documents.
   ──────────────────────────────────────────────────────────────────── */
router.get(
  "/signed-url",
  authenticate,
  asyncHandler(async (req, res) => {
    const { key } = z
      .object({ key: z.string().min(1) })
      .parse(req.query);

    /* If it's already a full URL, return it as-is */
    if (key.startsWith("http://") || key.startsWith("https://")) {
      sendSuccess(res, { url: key });
      return;
    }

    const url = await storageService.getSignedUrl(key, 3600);
    sendSuccess(res, { url, expiresIn: 3600 });
  }),
);

export default router;
