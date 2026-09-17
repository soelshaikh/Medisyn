import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess, sendList } from "@/common/utils/response";
import { AppError } from "@/common/middleware/error.middleware";
import { UserModel } from "./users.schema";
import { RoleModel } from "@/modules/roles/roles.schema";
import { logAction } from "@/modules/audit/audit.service";

const router = Router();
router.use(authenticate);

/* ── /users/me ── */
router.get("/me", asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.user!._id).populate("roles", "slug name permissions").lean();
  if (!user) throw new AppError("User not found", 404);
  sendSuccess(res, {
    id:            String(user._id),
    email:         user.email,
    fullName:      user.fullName,
    phone:         user.phone,
    role:          user.role,
    status:        user.status,
    emailVerified: user.emailVerified,
    createdAt:     user.createdAt,
  });
}));

router.patch("/me", asyncHandler(async (req, res) => {
  const UpdateDto = z.object({
    fullName: z.string().min(2).max(160).optional(),
    phone:    z.string().optional(),
  });
  const dto = UpdateDto.parse(req.body);
  const user = await UserModel.findByIdAndUpdate(req.user!._id, dto, { new: true }).lean();
  sendSuccess(res, user, "Profile updated");
}));

/* ── Admin: /admin/users ── */
router.get("/", requirePermission("users.read"), asyncHandler(async (req, res) => {
  const page  = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip  = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (req.query.search) {
    filter.$or = [
      { fullName: { $regex: req.query.search, $options: "i" } },
      { email:    { $regex: req.query.search, $options: "i" } },
    ];
  }
  if (req.query.status) filter.status = req.query.status;
  if (req.query.role)   filter.role   = req.query.role;

  const [users, total] = await Promise.all([
    UserModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    UserModel.countDocuments(filter),
  ]);

  sendList(res, users.map((u) => ({
    id:       String(u._id),
    email:    u.email,
    fullName: u.fullName,
    role:     u.role,
    status:   u.status,
    emailVerified: u.emailVerified,
    createdAt: u.createdAt,
  })), { page, limit, total });
}));

router.patch("/:id/status", requirePermission("users.suspend"), asyncHandler(async (req, res) => {
  const { status } = z.object({
    status: z.enum(["active", "suspended", "deactivated"]),
  }).parse(req.body);

  const before = await UserModel.findById(req.params.id).lean();
  if (!before) throw new AppError("User not found", 404);

  const user = await UserModel.findByIdAndUpdate(req.params.id, { status }, { new: true }).lean();
  if (!user) throw new AppError("User not found", 404);

  await logAction({
    userId:     req.user!._id,
    userEmail:  req.user!.email,
    actorName:  req.user!.fullName,
    action:     `user.status.${status}`,
    resource:   "user",
    resourceId: String(req.params.id),
    before:     { status: before.status },
    after:      { status },
    ipAddress:  req.ip ?? "",
  });

  sendSuccess(res, { id: String(user._id), status: user.status }, "Status updated");
}));

router.get("/:id", requirePermission("users.read"), asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.params.id)
    .populate("roles", "slug name permissions")
    .lean();
  if (!user) throw new AppError("User not found", 404);
  const { passwordHash: _pw, verificationToken: _vt, resetToken: _rt, ...safe } = user as Record<string, unknown>;
  sendSuccess(res, { ...safe, _id: String((safe as { _id: unknown })._id) });
}));

router.patch("/:id/roles", requirePermission("roles.assign"), asyncHandler(async (req, res) => {
  const { roleIds } = z.object({ roleIds: z.array(z.string()) }).parse(req.body);

  const roles = await RoleModel.find({ _id: { $in: roleIds } }).lean();
  if (roles.length !== roleIds.length) throw new AppError("One or more role IDs are invalid", 400);

  const before = await UserModel.findById(req.params.id).lean();
  if (!before) throw new AppError("User not found", 404);

  const user = await UserModel.findByIdAndUpdate(
    req.params.id,
    { roles: roleIds },
    { new: true },
  ).lean();
  if (!user) throw new AppError("User not found", 404);

  await logAction({
    userId:     req.user!._id,
    userEmail:  req.user!.email,
    actorName:  req.user!.fullName,
    action:     "user.roles_updated",
    resource:   "user",
    resourceId: String(req.params.id),
    before:     { roles: before.roles },
    after:      { roles: roleIds },
    ipAddress:  req.ip ?? "",
  });

  sendSuccess(res, { id: String(user._id), roles: user.roles }, "Roles updated");
}));

export default router;
