import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import * as rolesService from "./roles.service";

const CreateRoleDto = z.object({
  name:        z.string().min(1).max(60),
  slug:        z.string().min(1).max(60).regex(/^[a-z_]+$/, "Slug must be lowercase with underscores"),
  description: z.string().max(255).optional(),
});

const UpdateRoleDto = z.object({
  name:        z.string().min(1).max(60).optional(),
  description: z.string().max(255).optional(),
});

const SetPermissionsDto = z.object({
  permissions: z.array(z.string()),
});

export const list      = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await rolesService.listRoles());
});

export const getById   = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await rolesService.getRoleById(String(req.params.id)));
});

export const create    = asyncHandler(async (req: Request, res: Response) => {
  const dto = CreateRoleDto.parse(req.body);
  sendSuccess(res, await rolesService.createRole(dto), "Role created", 201);
});

export const update    = asyncHandler(async (req: Request, res: Response) => {
  const dto = UpdateRoleDto.parse(req.body);
  sendSuccess(res, await rolesService.updateRole(String(req.params.id), dto), "Role updated");
});

export const remove    = asyncHandler(async (req: Request, res: Response) => {
  await rolesService.deleteRole(String(req.params.id));
  sendSuccess(res, null, "Role deleted");
});

export const setPermissions = asyncHandler(async (req: Request, res: Response) => {
  const { permissions } = SetPermissionsDto.parse(req.body);
  sendSuccess(res, await rolesService.setRolePermissions(String(req.params.id), permissions), "Permissions updated");
});
