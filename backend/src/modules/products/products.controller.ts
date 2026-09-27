import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess, sendList } from "@/common/utils/response";
import { AppError } from "@/common/middleware/error.middleware";
import { storageService } from "@/modules/files/file-storage.service";
import * as svc from "./products.service";

const CreateDto = z.object({
  name:                 z.string().min(1).max(200),
  sku:                  z.string().min(1).max(50),
  description:          z.string().optional(),
  shortDescription:     z.string().max(500).optional(),
  categoryId:           z.string().min(1),
  brandId:              z.string().nullable().optional(),
  din:                  z.string().max(20).optional(),
  upc:                  z.string().max(30).optional(),
  price:                z.number().int().min(0),
  compareAtPrice:       z.number().int().min(0).nullable().optional(),
  requiresPrescription: z.boolean().optional(),
  ageRestriction:       z.number().int().min(0).nullable().optional(),
  status:               z.enum(["draft", "active", "archived"]).optional(),
  tags:                 z.array(z.string()).optional(),
  videoUrls:            z.array(z.string().url()).optional(),
  weight:               z.number().min(0).nullable().optional(),
  metaTitle:            z.string().max(160).optional(),
  metaDescription:      z.string().max(320).optional(),
  initialStock:         z.number().int().min(0).optional(),
  lowStockThreshold:    z.number().int().min(0).optional(),
});

const UpdateDto = CreateDto.omit({ sku: true, initialStock: true, lowStockThreshold: true }).partial();

const FiltersDto = z.object({
  categoryId:           z.string().optional(),
  brandId:              z.string().optional(),
  search:               z.string().optional(),
  status:               z.string().optional(),
  requiresPrescription: z.coerce.boolean().optional(),
  inStock:              z.coerce.boolean().optional(),
  priceMin:             z.coerce.number().optional(),
  priceMax:             z.coerce.number().optional(),
  page:                 z.coerce.number().int().min(1).optional(),
  limit:                z.coerce.number().int().min(1).max(100).optional(),
});

function actor(req: Request) {
  if (!req.user) return undefined;
  return { id: req.user._id, email: req.user.email, name: req.user.fullName, ip: req.ip };
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const filters = FiltersDto.parse(req.query);
  const { products, total, page, limit } = await svc.listProducts(filters, false);
  sendList(res, products, { page, limit, total });
});

export const listAdmin = asyncHandler(async (req: Request, res: Response) => {
  const filters = FiltersDto.parse(req.query);
  const { products, total, page, limit } = await svc.listProducts(filters, true);
  sendList(res, products, { page, limit, total });
});

export const getBySlug = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, await svc.getProductBySlug(String(req.params.slug)))
);

export const getById = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, await svc.getProductById(String(req.params.id)))
);

export const create = asyncHandler(async (req: Request, res: Response) => {
  const dto = CreateDto.parse(req.body);
  sendSuccess(res, await svc.createProduct(dto, actor(req)), "Product created", 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const dto = UpdateDto.parse(req.body);
  sendSuccess(res, await svc.updateProduct(String(req.params.id), dto, actor(req)), "Product updated");
});

export const archive = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, await svc.archiveProduct(String(req.params.id), actor(req)), "Product archived")
);

export const addImage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError("No image uploaded", 400);

  const { alt, isPrimary } = z.object({
    alt:       z.string().optional(),
    isPrimary: z.preprocess((v) => v === "true" || v === true, z.boolean()).optional(),
  }).parse(req.body);

  const { url } = await storageService.upload({
    buffer:       req.file.buffer,
    originalName: req.file.originalname,
    mimeType:     req.file.mimetype,
    folder:       "products",
  });

  sendSuccess(res, await svc.addProductImage(String(req.params.id), { url, alt, isPrimary }), "Image added");
});

export const setPrimaryImage = asyncHandler(async (req: Request, res: Response) => {
  const { url } = z.object({ url: z.string().min(1) }).parse(req.body);
  sendSuccess(res, await svc.setPrimaryImage(String(req.params.id), url), "Primary image updated");
});

export const reorderImages = asyncHandler(async (req: Request, res: Response) => {
  const { urls } = z.object({ urls: z.array(z.string().min(1)).min(1) }).parse(req.body);
  sendSuccess(res, await svc.reorderImages(String(req.params.id), urls), "Image order saved");
});

export const removeImage = asyncHandler(async (req: Request, res: Response) => {
  const { url } = z.object({ url: z.string().min(1) }).parse(req.body);
  sendSuccess(res, await svc.removeProductImage(String(req.params.id), url), "Image removed");
});
