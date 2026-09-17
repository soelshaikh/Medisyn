import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { config } from "@/config";
import { AppError } from "@/common/middleware/error.middleware";
import { UserModel } from "@/modules/users/users.schema";
import { RefreshTokenModel } from "./auth.schema";
import type { RegisterDtoType, LoginDtoType, ResetPasswordDtoType } from "./auth.dto";

/* ── Token helpers ── */
function generateAccessToken(userId: string, email: string, role: string) {
  return jwt.sign({ sub: userId, email, role }, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

async function generateRefreshToken(userId: string) {
  const token = randomBytes(64).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await RefreshTokenModel.create({ userId, token, expiresAt });
  return token;
}

function mapUser(user: InstanceType<typeof UserModel>) {
  return {
    id:            String(user._id),
    email:         user.email,
    fullName:      user.fullName,
    phone:         user.phone,
    role:          user.role,
    status:        user.status,
    emailVerified: user.emailVerified,
    createdAt:     user.createdAt,
  };
}

/* ── Register ── */
export async function register(data: RegisterDtoType) {
  const exists = await UserModel.findOne({ email: data.email.toLowerCase() });
  if (exists) throw new AppError("Email already registered", 409);

  const passwordHash = await argon2.hash(data.password);
  const verificationToken = randomBytes(32).toString("hex");
  const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  const user = await UserModel.create({
    email:    data.email.toLowerCase(),
    passwordHash,
    fullName: data.fullName,
    phone:    data.phone,
    role:     "patient",
    status:   "pending_verification",
    verificationToken,
    verificationTokenExpires,
  });

  // TODO Phase 7: queue verification email instead of direct send
  // emailQueue.add({ template: 'verify-email', to: user.email, token: verificationToken })

  return { user: mapUser(user), verificationToken };
}

/* ── Login ── */
export async function login(data: LoginDtoType) {
  const user = await UserModel.findOne({ email: data.email.toLowerCase() }).select("+passwordHash");
  if (!user) throw new AppError("Invalid email or password", 401);

  const valid = await argon2.verify(user.passwordHash, data.password);
  if (!valid) throw new AppError("Invalid email or password", 401);

  if (!user.emailVerified) throw new AppError("Please verify your email first", 403);
  if (user.status === "suspended") throw new AppError("Account suspended", 403);
  if (user.status === "deactivated") throw new AppError("Account deactivated", 403);

  const accessToken  = generateAccessToken(String(user._id), user.email, user.role);
  const refreshToken = await generateRefreshToken(String(user._id));

  return { user: mapUser(user), accessToken, refreshToken };
}

/* ── Refresh ── */
export async function refresh(token: string) {
  const record = await RefreshTokenModel.findOne({ token });
  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  const user = await UserModel.findById(record.userId);
  if (!user) throw new AppError("User not found", 401);

  /* Rotate: revoke old, issue new */
  await RefreshTokenModel.findByIdAndUpdate(record._id, { revokedAt: new Date() });
  const accessToken  = generateAccessToken(String(user._id), user.email, user.role);
  const refreshToken = await generateRefreshToken(String(user._id));

  return { accessToken, refreshToken };
}

/* ── Logout ── */
export async function logout(token: string) {
  await RefreshTokenModel.findOneAndUpdate({ token }, { revokedAt: new Date() });
}

/* ── Verify email ── */
export async function verifyEmail(token: string) {
  const user = await UserModel.findOne({ verificationToken: token }).select("+verificationToken +verificationTokenExpires");
  if (!user) throw new AppError("Invalid verification token", 400);
  if (user.verificationTokenExpires && user.verificationTokenExpires < new Date()) {
    throw new AppError("Verification token expired — please request a new one", 400);
  }

  await UserModel.findByIdAndUpdate(user._id, {
    emailVerified: true,
    status: "active",
    verificationToken: undefined,
    verificationTokenExpires: undefined,
  });
}

/* ── Forgot password ── */
export async function forgotPassword(email: string) {
  const user = await UserModel.findOne({ email: email.toLowerCase() });
  // Always respond success — don't reveal whether email exists
  if (!user) return;

  const resetToken = randomBytes(32).toString("hex");
  const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h

  await UserModel.findByIdAndUpdate(user._id, { resetToken, resetTokenExpires });

  // TODO Phase 7: queue reset email
  // emailQueue.add({ template: 'reset-password', to: user.email, token: resetToken })
}

/* ── Reset password ── */
export async function resetPassword(data: ResetPasswordDtoType) {
  const user = await UserModel.findOne({ resetToken: data.token }).select("+resetToken +resetTokenExpires");
  if (!user) throw new AppError("Invalid reset token", 400);
  if (user.resetTokenExpires && user.resetTokenExpires < new Date()) {
    throw new AppError("Reset token expired — please request a new one", 400);
  }

  const passwordHash = await argon2.hash(data.password);
  await UserModel.findByIdAndUpdate(user._id, {
    passwordHash,
    resetToken: undefined,
    resetTokenExpires: undefined,
  });

  /* Revoke all refresh tokens for this user */
  await RefreshTokenModel.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });
}
