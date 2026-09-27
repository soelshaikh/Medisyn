import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import * as svc from "./brands.service";

const BrandDto = z.object({
  name:        z.string().min(1).max(100),
  description: z.string().max(5000).optional(),
  logoUrl:     z.string().url().optional().or(z.literal("")),
  website:     z.string().url().optional().or(z.literal("")),
  isActive:    z.boolean().optional(),
});

export const list = asyncHandler(async (_req: Request, res: Response) =>
  sendSuccess(res, await svc.listBrands(true))
);

export const listAdmin = asyncHandler(async (_req: Request, res: Response) =>
  sendSuccess(res, await svc.listBrands(false))
);

export const getBySlug = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, await svc.getBrandBySlug(String(req.params.slug)))
);

export const getById = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, await svc.getBrandById(String(req.params.id)))
);

export const create = asyncHandler(async (req: Request, res: Response) => {
  const dto = BrandDto.parse(req.body);
  sendSuccess(res, await svc.createBrand(dto), "Brand created", 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const dto = BrandDto.partial().parse(req.body);
  sendSuccess(res, await svc.updateBrand(String(req.params.id), dto), "Brand updated");
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await svc.deleteBrand(String(req.params.id)), "Brand deleted");
});
