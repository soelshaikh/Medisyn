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

/* ── Saved addresses ── */
const AddressDto = z.object({
  label:      z.string().max(50).optional().default("Home"),
  fullName:   z.string().min(1),
  phone:      z.string().min(7),
  address1:   z.string().min(1),
  address2:   z.string().optional().default(""),
  city:       z.string().min(1),
  province:   z.string().min(2).max(2),
  postalCode: z.string().min(6).max(7),
  isDefault:  z.boolean().optional().default(false),
});

router.get("/me/addresses", asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.user!._id).lean();
  sendSuccess(res, user?.savedAddresses ?? []);
}));

router.post("/me/addresses", asyncHandler(async (req, res) => {
  const dto  = AddressDto.parse(req.body);
  const user = await UserModel.findById(req.user!._id);
  if (!user) throw new AppError("User not found", 404);
  if (dto.isDefault) user.savedAddresses.forEach((a) => { a.isDefault = false; });
  user.savedAddresses.push({ ...dto, country: "CA" } as never);
  await user.save();
  sendSuccess(res, user.savedAddresses, "Address added", 201);
}));

router.patch("/me/addresses/:addrId", asyncHandler(async (req, res) => {
  const dto  = AddressDto.partial().parse(req.body);
  const user = await UserModel.findById(req.user!._id);
  if (!user) throw new AppError("User not found", 404);
  const addr = user.savedAddresses.id(String(req.params.addrId));
  if (!addr) throw new AppError("Address not found", 404);
  if (dto.isDefault) user.savedAddresses.forEach((a) => { a.isDefault = false; });
  Object.assign(addr, dto);
  await user.save();
  sendSuccess(res, user.savedAddresses, "Address updated");
}));

router.delete("/me/addresses/:addrId", asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.user!._id);
  if (!user) throw new AppError("User not found", 404);
  const addr = user.savedAddresses.id(String(req.params.addrId));
  if (!addr) throw new AppError("Address not found", 404);
  addr.deleteOne();
  await user.save();
  sendSuccess(res, null, "Address removed");
}));

router.patch("/me/addresses/:addrId/default", asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.user!._id);
  if (!user) throw new AppError("User not found", 404);
  const addr = user.savedAddresses.id(String(req.params.addrId));
  if (!addr) throw new AppError("Address not found", 404);
  user.savedAddresses.forEach((a) => { a.isDefault = false; });
  addr.isDefault = true;
  await user.save();
  sendSuccess(res, user.savedAddresses, "Default address updated");
}));

/* ── Customer search (typeahead) ── */
router.get("/search", requirePermission("users.read"), asyncHandler(async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) { sendSuccess(res, []); return; }

  const users = await UserModel.find({
    $or: [
      { fullName: { $regex: q, $options: "i" } },
      { email:    { $regex: q, $options: "i" } },
      { phone:    { $regex: q, $options: "i" } },
      { uhid:     { $regex: `^${q}`, $options: "i" } },
    ],
  }).select("fullName email phone uhid").limit(10).lean();

  sendSuccess(res, users.map((u) => ({
    _id:      String(u._id),
    uhid:     u.uhid ?? null,
    fullName: u.fullName,
    email:    u.email,
    phone:    u.phone ?? null,
  })));
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
  if (req.query.hasRoles === "true")  filter["roles.0"] = { $exists: true };
  if (req.query.hasRoles === "false") filter["roles.0"] = { $exists: false };

  const [users, total] = await Promise.all([
    UserModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate("roles", "name slug")
      .lean(),
    UserModel.countDocuments(filter),
  ]);

  sendList(res, users.map((u) => ({
    _id:      String(u._id),
    uhid:     u.uhid ?? null,
    email:    u.email,
    fullName: u.fullName,
    role:     u.role,
    roles:    ((u.roles ?? []) as unknown as Array<{ _id: unknown; name: string; slug: string }>).map((r) => ({ _id: String(r._id), name: r.name, slug: r.slug })),
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
