import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import * as svc from "./products.service";

const CreateDto = z.object({
  name:                 z.string().min(1).max(200),
  sku:                  z.string().min(1).max(50),
  description:          z.string().optional(),
  shortDescription:     z.string().max(500).optional(),
  categoryId:           z.string().min(1),
  price:                z.number().int().min(0),
  compareAtPrice:       z.number().int().min(0).nullable().optional(),
  requiresPrescription: z.boolean().optional(),
  ageRestriction:       z.number().int().min(0).nullable().optional(),
  status:               z.enum(["draft", "active", "archived"]).optional(),
  tags:                 z.array(z.string()).optional(),
  weight:               z.number().min(0).nullable().optional(),
  metaTitle:            z.string().max(160).optional(),
  metaDescription:      z.string().max(320).optional(),
  initialStock:         z.number().int().min(0).optional(),
  lowStockThreshold:    z.number().int().min(0).optional(),
});

const UpdateDto = CreateDto.omit({ sku: true, initialStock: true, lowStockThreshold: true }).partial();

const FiltersDto = z.object({
  categoryId:           z.string().optional(),
  search:               z.string().optional(),
  status:               z.string().optional(),
  requiresPrescription: z.coerce.boolean().optional(),
  inStock:              z.coerce.boolean().optional(),
  priceMin:             z.coerce.number().optional(),
  priceMax:             z.coerce.number().optional(),
  page:                 z.coerce.number().int().min(1).optional(),
  limit:                z.coerce.number().int().min(1).max(100).optional(),
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const filters = FiltersDto.parse(req.query);
  const result  = await svc.listProducts(filters, false);
  sendSuccess(res, result);
});

export const listAdmin = asyncHandler(async (req: Request, res: Response) => {
  const filters = FiltersDto.parse(req.query);
  const result  = await svc.listProducts(filters, true);
  sendSuccess(res, result);
});

export const getBySlug = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, await svc.getProductBySlug(String(req.params.slug)))
);

export const getById = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, await svc.getProductById(String(req.params.id)))
);

export const create = asyncHandler(async (req: Request, res: Response) => {
  const dto = CreateDto.parse(req.body);
  sendSuccess(res, await svc.createProduct(dto), "Product created", 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const dto = UpdateDto.parse(req.body);
  sendSuccess(res, await svc.updateProduct(String(req.params.id), dto), "Product updated");
});

export const archive = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, await svc.archiveProduct(String(req.params.id)), "Product archived")
);

export const addImage = asyncHandler(async (req: Request, res: Response) => {
  const dto = z.object({
    url:       z.string().min(1),
    alt:       z.string().optional(),
    isPrimary: z.boolean().optional(),
  }).parse(req.body);
  sendSuccess(res, await svc.addProductImage(String(req.params.id), dto), "Image added");
});

export const removeImage = asyncHandler(async (req: Request, res: Response) => {
  const { url } = z.object({ url: z.string().min(1) }).parse(req.body);
  sendSuccess(res, await svc.removeProductImage(String(req.params.id), url), "Image removed");
});
