import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "@/config";
import { AppError } from "./error.middleware";
import { UserModel } from "@/modules/users/users.schema";
import { RoleModel } from "@/modules/roles/roles.schema";

interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError("Authentication required", 401);
    }

    const token = header.slice(7);
    const payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as AccessTokenPayload;

    const user = await UserModel.findById(payload.sub).lean();
    if (!user) throw new AppError("User not found", 401);
    if (user.status === "suspended") throw new AppError("Account suspended", 403);
    if (user.status === "deactivated") throw new AppError("Account deactivated", 403);

    /* Resolve effective permissions from roles + direct overrides */
    const roles = await RoleModel.find({ _id: { $in: user.roles } }).lean();
    const rolePermissions = roles.flatMap((r) => r.permissions);
    const effectivePermissions = [
      ...new Set([...rolePermissions, ...(user.directPermissions ?? [])]),
    ];

    req.user = { ...user, _id: String(user._id), effectivePermissions };
    next();
  } catch (err) {
    next(err instanceof AppError ? err : new AppError("Invalid or expired token", 401));
  }
}

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError("Authentication required", 401));

    if (!req.user.effectivePermissions.includes(permission)) {
      return next(new AppError(`Permission denied: ${permission}`, 403));
    }
    next();
  };
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();
  authenticate(req, _res, next);
}
