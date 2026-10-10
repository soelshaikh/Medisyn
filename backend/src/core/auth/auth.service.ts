import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';
import { withTenantContext } from '@/lib/tenant-context';
import {
  getFacilityBySlug,
  getUserByEmail,
  createUser,
  createSession,
  getSessionById,
  revokeSession,
  revokeSessionOnRotation,
  revokeAllUserSessions,
  incrementAuthVersion,
  updateUserPasswordAndVersion,
  setPasswordResetToken,
  getUserByPasswordResetToken,
  clearPasswordResetToken,
  setEmailVerifyToken,
  getUserByEmailVerifyToken,
  clearEmailVerifyTokenAndMarkVerified,
  updateLastLoginAt,
  getFacilityUserByUserAndFacility,
  getFacilityRoleName,
  writeAuthAuditEntry,
} from '@/core/super-admin/auth-queries.service';
import {
  createFacilityPatientRole,
  createFacilityUserLink,
} from './auth-facility-helpers';
import { sendVerificationEmail, sendPasswordResetEmail } from './email.service';
import { AppError, AuthError, ForbiddenError, ValidationError } from '@/lib/errors';
import type {
  RegisterBody,
  LoginBody,
  SuperAdminLoginBody,
  ForgotPasswordBody,
  ResetPasswordBody,
  VerifyEmailBody,
  ResendVerificationBody,
} from './auth.validator';

// ── Internal helpers ──────────────────────────────────────────────────────

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_ACCESS_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as jwt.SignOptions['expiresIn'];

interface JwtPayload {
  sub: string;
  sessionId: string;
  facilityId: string | null;
  authVersion: number;
  role: string;
  isSuperAdmin: boolean;
}

function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRES_IN });
}

function parseExpiredJwt(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }) as JwtPayload;
  } catch {
    return null;
  }
}

// ── Auth Service ──────────────────────────────────────────────────────────

export const authService = {

  // ── Register ────────────────────────────────────────────────────────────
  async register(
    dto: RegisterBody,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ userId: string }> {
    const facility = await getFacilityBySlug(dto.facilitySlug);
    if (!facility) throw new AppError('FACILITY_NOT_FOUND', 'Facility not found', 404);
    if (facility.status !== 'active')
      throw new ForbiddenError('FACILITY_INACTIVE', 'Facility is not accepting registrations');

    const existingUser = await getUserByEmail(dto.email);
    let userId: string;

    if (existingUser) {
      const existingLink = await getFacilityUserByUserAndFacility(existingUser.id, facility.id);
      if (existingLink) {
        throw new AppError('EMAIL_IN_USE', 'Email address is already registered at this pharmacy', 409);
      }
      const passwordMatch = await argon2.verify(existingUser.passwordHash, dto.password);
      if (!passwordMatch) {
        throw new AppError(
          'ACCOUNT_EXISTS_LOGIN',
          'An account with this email already exists on our platform. Please log in to link your account.',
          409,
        );
      }
      userId = existingUser.id;
    } else {
      const passwordHash = await argon2.hash(dto.password);
      const newUser = await createUser({
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      });
      userId = newUser.id;
    }

    await withTenantContext(facility.id, async (tx) => {
      const role = await createFacilityPatientRole(tx, facility.id);
      await createFacilityUserLink(tx, { facilityId: facility.id, userId, roleId: role.id });
    });

    const verifyToken = uuidv4();
    await setEmailVerifyToken(userId, verifyToken, addHours(new Date(), 24));
    void sendVerificationEmail(dto.email, dto.firstName, verifyToken, facility.name);

    await writeAuthAuditEntry({
      facilityId: facility.id,
      actorId: userId,
      action: 'auth.register',
      ipAddress,
      userAgent,
    });

    return { userId };
  },

  // ── Login ──────────────────────────────────────────────────────────────
  async login(
    dto: LoginBody,
    ipAddress: string,
    userAgent: string,
  ): Promise<{
    accessToken: string;
    rawRefreshToken: string;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      emailVerified: boolean;
      role: string;
      facilityId: string | null;
    };
  }> {
    if (!dto.facilitySlug) {
      throw new ValidationError('facilitySlug is required');
    }

    const facility = await getFacilityBySlug(dto.facilitySlug);
    if (!facility) throw new AppError('FACILITY_NOT_FOUND', 'Facility not found', 404);
    if (facility.status !== 'active')
      throw new ForbiddenError('FACILITY_INACTIVE', 'Facility is suspended');

    const user = await getUserByEmail(dto.email);
    if (!user) {
      await writeAuthAuditEntry({
        facilityId: facility.id,
        action: 'auth.login_failed',
        metadata: { reason: 'email_not_found' },
        ipAddress,
        userAgent,
      });
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const passwordMatch = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordMatch) {
      await writeAuthAuditEntry({
        facilityId: facility.id,
        actorId: user.id,
        action: 'auth.login_failed',
        metadata: { reason: 'wrong_password' },
        ipAddress,
        userAgent,
      });
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const facilityUser = await getFacilityUserByUserAndFacility(user.id, facility.id);
    if (!facilityUser || !facilityUser.isActive) {
      throw new ForbiddenError('ACCOUNT_INACTIVE', 'Your account is inactive at this pharmacy');
    }

    const roleName = await getFacilityRoleName(facilityUser.roleId);

    const sessionId = uuidv4();
    const rawRefreshToken = randomBytes(32).toString('hex');
    const refreshTokenHash = await argon2.hash(rawRefreshToken);

    await createSession({
      id: sessionId,
      userId: user.id,
      facilityId: facility.id,
      refreshTokenHash,
      userAgent,
      ipAddress,
      expiresAt: addDays(new Date(), 30),
    });

    const accessToken = signAccessToken({
      sub: user.id,
      sessionId,
      facilityId: facility.id,
      authVersion: user.authVersion,
      role: roleName ?? 'patient',
      isSuperAdmin: user.isPlatformSuperAdmin,
    });

    await updateLastLoginAt(user.id);

    await writeAuthAuditEntry({
      facilityId: facility.id,
      actorId: user.id,
      action: 'auth.login',
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: user.emailVerified,
        role: roleName ?? 'patient',
        facilityId: facility.id,
      },
    };
  },

  // ── Refresh Token ──────────────────────────────────────────────────────
  async refreshToken(
    expiredAccessToken: string | undefined,
    rawRefreshToken: string | undefined,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ accessToken: string; rawRefreshToken: string }> {
    if (!rawRefreshToken) {
      throw new AuthError('REFRESH_TOKEN_MISSING', 'Refresh token cookie is required');
    }
    if (!expiredAccessToken) {
      throw new AuthError('REFRESH_TOKEN_INVALID', 'Access token required for session renewal');
    }

    const claims = parseExpiredJwt(expiredAccessToken);
    if (!claims?.sessionId) {
      throw new AuthError('REFRESH_TOKEN_INVALID', 'Invalid access token');
    }

    const session = await getSessionById(claims.sessionId);
    if (!session) {
      throw new AuthError('REFRESH_TOKEN_INVALID', 'Session not found');
    }

    // Theft detection: old (rotated) token reuse
    if (session.revokedAt && session.revokedReason === 'rotated') {
      await revokeAllUserSessions(session.userId, 'admin_revoked');
      await writeAuthAuditEntry({
        facilityId: session.facilityId ?? undefined,
        actorId: session.userId,
        action: 'auth.logout_all',
        metadata: { reason: 'theft_detected' },
        ipAddress,
        userAgent,
      });
      throw new AuthError('REFRESH_TOKEN_REUSE', 'Possible token theft detected — all sessions have been revoked');
    }

    if (session.revokedAt) {
      throw new AuthError('SESSION_REVOKED', 'Session has been revoked');
    }

    if (session.expiresAt < new Date()) {
      throw new AuthError('REFRESH_TOKEN_EXPIRED', 'Refresh token has expired. Please log in again.');
    }

    const tokenMatch = await argon2.verify(session.refreshTokenHash, rawRefreshToken);
    if (!tokenMatch) {
      throw new AuthError('REFRESH_TOKEN_INVALID', 'Invalid refresh token');
    }

    const newSessionId = uuidv4();
    const newRawRefreshToken = randomBytes(32).toString('hex');
    const newRefreshTokenHash = await argon2.hash(newRawRefreshToken);

    await createSession({
      id: newSessionId,
      userId: session.userId,
      facilityId: session.facilityId ?? null,
      refreshTokenHash: newRefreshTokenHash,
      userAgent,
      ipAddress,
      expiresAt: addDays(new Date(), 30),
    });
    await revokeSessionOnRotation(claims.sessionId);

    const newAccessToken = signAccessToken({
      sub: session.userId,
      sessionId: newSessionId,
      facilityId: session.facilityId ?? null,
      authVersion: claims.authVersion,
      role: claims.role,
      isSuperAdmin: claims.isSuperAdmin,
    });

    await writeAuthAuditEntry({
      facilityId: session.facilityId ?? undefined,
      actorId: session.userId,
      action: 'auth.token_refresh',
      ipAddress,
      userAgent,
    });

    return { accessToken: newAccessToken, rawRefreshToken: newRawRefreshToken };
  },

  // ── Logout ─────────────────────────────────────────────────────────────
  async logout(
    sessionId: string,
    userId: string,
    facilityId: string | null,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    await revokeSession(sessionId, 'user_logout');

    await writeAuthAuditEntry({
      facilityId: facilityId ?? undefined,
      actorId: userId,
      action: 'auth.logout',
      ipAddress,
      userAgent,
    });
  },

  // ── Logout All ─────────────────────────────────────────────────────────
  async logoutAll(
    userId: string,
    facilityId: string | null,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    await revokeAllUserSessions(userId, 'user_logout');
    await incrementAuthVersion(userId);

    await writeAuthAuditEntry({
      facilityId: facilityId ?? undefined,
      actorId: userId,
      action: 'auth.logout_all',
      ipAddress,
      userAgent,
    });
  },

  // ── Forgot Password ────────────────────────────────────────────────────
  async forgotPassword(
    dto: ForgotPasswordBody,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    const GENERIC_RESPONSE = undefined; // void — always returns the same way

    const user = await getUserByEmail(dto.email);
    if (!user) return GENERIC_RESPONSE;

    const resetToken = uuidv4();
    await setPasswordResetToken(user.id, resetToken, addMinutes(new Date(), 30));

    // Get facility name for email (best-effort)
    let facilityName = 'MediSyn';
    try {
      const link = await getFacilityUserByUserAndFacility(user.id, '');
      void link; // unused — we just want a fallback name
    } catch {
      // ignore
    }

    void sendPasswordResetEmail(user.email, user.firstName, resetToken, facilityName);

    await writeAuthAuditEntry({
      actorId: user.id,
      action: 'auth.password_reset_request',
      ipAddress,
      userAgent,
    });
  },

  // ── Reset Password ─────────────────────────────────────────────────────
  async resetPassword(
    dto: ResetPasswordBody,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    const user = await getUserByPasswordResetToken(dto.token);

    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      throw new AppError('RESET_TOKEN_INVALID', 'Password reset link is invalid or has expired', 400);
    }

    const newHash = await argon2.hash(dto.password);
    await updateUserPasswordAndVersion(user.id, newHash);
    await clearPasswordResetToken(user.id);
    await revokeAllUserSessions(user.id, 'password_changed');

    await writeAuthAuditEntry({
      actorId: user.id,
      action: 'auth.password_reset_complete',
      ipAddress,
      userAgent,
    });
  },

  // ── Verify Email ───────────────────────────────────────────────────────
  async verifyEmail(
    dto: VerifyEmailBody,
  ): Promise<void> {
    const user = await getUserByEmailVerifyToken(dto.token);

    if (!user) {
      throw new AppError('VERIFY_TOKEN_INVALID', 'Email verification link is invalid or has expired', 400);
    }

    // Idempotent: already verified
    if (user.emailVerified) {
      return;
    }

    if (!user.emailVerifyExpiresAt || user.emailVerifyExpiresAt < new Date()) {
      throw new AppError('VERIFY_TOKEN_INVALID', 'Email verification link has expired', 400);
    }

    await clearEmailVerifyTokenAndMarkVerified(user.id);

    await writeAuthAuditEntry({
      actorId: user.id,
      action: 'auth.email_verify',
    });
  },

  // ── Super Admin Login ──────────────────────────────────────────────────
  async superAdminLogin(
    dto: SuperAdminLoginBody,
    ipAddress: string,
    userAgent: string,
  ): Promise<{
    accessToken: string;
    rawRefreshToken: string;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
  }> {
    const user = await getUserByEmail(dto.email);
    if (!user) {
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (!user.isPlatformSuperAdmin) {
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const passwordMatch = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordMatch) {
      await writeAuthAuditEntry({
        action: 'auth.super_admin_login_failed',
        actorId: user.id,
        metadata: { reason: 'wrong_password' },
        ipAddress,
        userAgent,
      });
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (!user.emailVerified) {
      throw new AppError('EMAIL_NOT_VERIFIED', 'Please verify your email before logging in', 403);
    }

    const sessionId = uuidv4();
    const rawRefreshToken = randomBytes(32).toString('hex');
    const refreshTokenHash = await argon2.hash(rawRefreshToken);

    await createSession({
      id: sessionId,
      userId: user.id,
      facilityId: null,
      refreshTokenHash,
      userAgent,
      ipAddress,
      expiresAt: addDays(new Date(), 30),
    });

    const accessToken = signAccessToken({
      sub: user.id,
      sessionId,
      facilityId: null,
      authVersion: user.authVersion,
      role: 'super_admin',
      isSuperAdmin: true,
    });

    await updateLastLoginAt(user.id);

    await writeAuthAuditEntry({
      actorId: user.id,
      action: 'auth.super_admin_login',
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  },

  // ── Resend Verification ────────────────────────────────────────────────
  async resendVerification(
    dto: ResendVerificationBody,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    const user = await getUserByEmail(dto.email);
    if (!user || user.emailVerified) return;

    const newToken = uuidv4();
    await setEmailVerifyToken(user.id, newToken, addHours(new Date(), 24));
    void sendVerificationEmail(user.email, user.firstName, newToken, 'MediSyn');

    await writeAuthAuditEntry({
      actorId: user.id,
      action: 'auth.email_verify_resend',
      ipAddress,
      userAgent,
    });
  },
};
