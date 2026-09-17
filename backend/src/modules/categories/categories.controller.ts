import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import * as svc from "./categories.service";

const CreateDto = z.object({
  name:        z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  parentId:    z.string().nullable().optional(),
  image:       z.string().nullable().optional(),
  sortOrder:   z.number().int().optional(),
});

const UpdateDto = CreateDto.partial().extend({ isActive: z.boolean().optional() });

export const list      = asyncHandler(async (_req, res) => sendSuccess(res, await svc.listCategories()));
export const listAdmin = asyncHandler(async (_req, res) => sendSuccess(res, await svc.listAllCategories()));

export const create = asyncHandler(async (req: Request, res: Response) => {
  const dto = CreateDto.parse(req.body);
  sendSuccess(res, await svc.createCategory(dto), "Category created", 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const dto = UpdateDto.parse(req.body);
  sendSuccess(res, await svc.updateCategory(String(req.params.id), dto), "Category updated");
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await svc.deleteCategory(String(req.params.id));
  sendSuccess(res, null, "Category deleted");
});
