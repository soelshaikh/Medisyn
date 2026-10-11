import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';
import {
  getFacilityBySlug,
  writeAuthAuditEntry,
  resolveHealthProfessionalAuth,
  getPatientFacility,
  createPatientRecord,
} from '@/core/super-admin/auth-queries.service';
import {
  getIdentityUserByEmail,
  getIdentityUserById,
  getIdentityUserByPasswordResetToken,
  getIdentityUserByEmailVerifyToken,
  createIdentityUser,
  updateIdentityLastLoginAt,
  incrementIdentityAuthVersion,
  updateIdentityUserPasswordAndVersion,
  setIdentityPasswordResetToken,
  clearIdentityPasswordResetToken,
  setIdentityEmailVerifyToken,
  clearIdentityEmailVerifyTokenAndMarkVerified,
  createIdentitySession,
  getIdentitySessionById,
  revokeIdentitySession,
  revokeIdentitySessionOnRotation,
  revokeAllIdentityUserSessions,
  resolveUniqueUsername,
} from './identity-queries.service';
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

// ── Internal helpers ──────────────────────────────────────────────────────────

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

// Internal JWT signing type — must match JwtPayload in parse-jwt.ts
interface JwtPayload {
  sub: string;                              // identityUsers.id
  sessionId: string;
  accountType: 'super_admin' | 'facility_user' | 'patient';
  healthProfessionalId: string | null;
  facilityId: string | null;
  facilityPrefix: string | null;
  authVersion: number;
  roles: string[];
  permissions: string[];
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

// ── Auth Service ──────────────────────────────────────────────────────────────

export const authService = {

  // ── Patient Self-Registration ────────────────────────────────────────────
  // Creates a patient account scoped to a specific facility.
  // Route: POST /{facilitySlug}/register
  async register(
    dto: RegisterBody,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ userId: string }> {
    const facility = await getFacilityBySlug(dto.facilitySlug);
    if (!facility) throw new AppError('FACILITY_NOT_FOUND', 'Facility not found', 404);
    if (facility.status !== 'active')
      throw new ForbiddenError('FACILITY_INACTIVE', 'Facility is not accepting registrations');

    if (!facility.prefix) {
      throw new AppError('SERVICE_UNAVAILABLE', 'Facility is not yet configured for registrations', 503);
    }

    const existingUser = await getIdentityUserByEmail(dto.email);
    if (existingUser) {
      // Already exists in identity DB — check if they're already a patient of this facility
      const existingFacilityId = await getPatientFacility(existingUser.id);
      if (existingFacilityId === facility.id) {
        throw new AppError('EMAIL_IN_USE', 'Email address is already registered at this pharmacy', 409);
      }
      // Existing user from a different facility is not allowed — one user = one facility
      throw new AppError(
        'ACCOUNT_EXISTS_LOGIN',
        'An account with this email already exists. Please log in.',
        409,
      );
    }

    const passwordHash = await argon2.hash(dto.password);
    const emailLocalPart = dto.email.split('@')[0] ?? dto.email;
    const { username, normalizedUsername } = await resolveUniqueUsername(
      emailLocalPart,
      facility.prefix,
    );

    const newUser = await createIdentityUser({
      email: dto.email,
      username,
      normalizedUsername,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      accountType: 'patient',
      facilityPrefix: facility.prefix,
    });

    await createPatientRecord({ userId: newUser.id, facilityId: facility.id });

    const verifyToken = uuidv4();
    await setIdentityEmailVerifyToken(newUser.id, verifyToken, addHours(new Date(), 24));
    void sendVerificationEmail(dto.email, dto.firstName, verifyToken, facility.name);

    await writeAuthAuditEntry({
      facilityId: facility.id,
      actorId: newUser.id,
      action: 'auth.register',
      ipAddress,
      userAgent,
    });

    return { userId: newUser.id };
  },

  // ── Facility Login ───────────────────────────────────────────────────────
  // Handles both facility_user (staff) and patient logins.
  // Route: POST /{facilitySlug}/login
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
      accountType: string;
      roles: string[];
      permissions: string[];
      facilityId: string | null;
      healthProfessionalId: string | null;
    };
  }> {
    if (!dto.facilitySlug) {
      throw new ValidationError('facilitySlug is required');
    }

    const facility = await getFacilityBySlug(dto.facilitySlug);
    if (!facility) throw new AppError('FACILITY_NOT_FOUND', 'Facility not found', 404);
    if (facility.status !== 'active')
      throw new ForbiddenError('FACILITY_INACTIVE', 'Facility is suspended');

    const user = await getIdentityUserByEmail(dto.email);
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

    // super_admin should not log in via facility route
    if (user.accountType === 'super_admin') {
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenError('ACCOUNT_INACTIVE', 'Your account has been deactivated');
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

    // Resolve facility membership and permissions based on account type
    let resolvedFacilityId: string | null = null;
    let healthProfessionalId: string | null = null;
    let roles: string[] = [];
    let permissions: string[] = [];

    if (user.accountType === 'facility_user') {
      const auth = await resolveHealthProfessionalAuth(user.id);
      if (!auth || auth.facilityId !== facility.id) {
        throw new ForbiddenError('ACCOUNT_INACTIVE', 'Your account is not active at this pharmacy');
      }
      resolvedFacilityId = auth.facilityId;
      healthProfessionalId = auth.healthProfessionalId;
      roles = auth.roles;
      permissions = auth.permissions;
    } else {
      // patient
      const patientFacilityId = await getPatientFacility(user.id);
      if (!patientFacilityId || patientFacilityId !== facility.id) {
        throw new ForbiddenError('ACCOUNT_INACTIVE', 'Your account is not registered at this pharmacy');
      }
      resolvedFacilityId = patientFacilityId;
      roles = ['patient'];
      permissions = [];
    }

    const sessionId = uuidv4();
    const rawRefreshToken = randomBytes(32).toString('hex');
    const refreshTokenHash = await argon2.hash(rawRefreshToken);

    await createIdentitySession({
      id: sessionId,
      userId: user.id,
      facilityId: resolvedFacilityId,
      refreshTokenHash,
      userAgent,
      ipAddress,
      expiresAt: addDays(new Date(), 30),
    });

    const accessToken = signAccessToken({
      sub: user.id,
      sessionId,
      accountType: user.accountType,
      healthProfessionalId,
      facilityId: resolvedFacilityId,
      facilityPrefix: user.facilityPrefix ?? null,
      authVersion: user.authVersion,
      roles,
      permissions,
    });

    await updateIdentityLastLoginAt(user.id);

    await writeAuthAuditEntry({
      facilityId: resolvedFacilityId ?? undefined,
      actorId: user.id,
      action: 'auth.login',
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      rawRefreshToken,
      user: {
        id:                  user.id,
        email:               user.email,
        firstName:           user.firstName,
        lastName:            user.lastName,
        emailVerified:       user.emailVerified,
        accountType:         user.accountType,
        roles,
        permissions,
        facilityId:          resolvedFacilityId,
        facilityName:        facility.name,
        healthProfessionalId,
      },
    };
  },

  // ── Refresh Token ────────────────────────────────────────────────────────
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

    const session = await getIdentitySessionById(claims.sessionId);
    if (!session) {
      throw new AuthError('REFRESH_TOKEN_INVALID', 'Session not found');
    }

    // Theft detection: old (rotated) token reuse
    if (session.revokedAt && session.revokedReason === 'rotated') {
      await revokeAllIdentityUserSessions(session.userId, 'admin_revoked');
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

    await createIdentitySession({
      id: newSessionId,
      userId: session.userId,
      facilityId: session.facilityId ?? null,
      refreshTokenHash: newRefreshTokenHash,
      userAgent,
      ipAddress,
      expiresAt: addDays(new Date(), 30),
    });
    await revokeIdentitySessionOnRotation(claims.sessionId);

    // Carry forward existing claims — role changes are signalled via authVersion bump
    const newAccessToken = signAccessToken({
      sub: session.userId,
      sessionId: newSessionId,
      accountType: claims.accountType,
      healthProfessionalId: claims.healthProfessionalId ?? null,
      facilityId: session.facilityId ?? null,
      facilityPrefix: claims.facilityPrefix ?? null,
      authVersion: claims.authVersion,
      roles: claims.roles ?? [],
      permissions: claims.permissions ?? [],
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

  // ── Logout ───────────────────────────────────────────────────────────────
  async logout(
    sessionId: string,
    userId: string,
    facilityId: string | null,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    await revokeIdentitySession(sessionId, 'user_logout');

    await writeAuthAuditEntry({
      facilityId: facilityId ?? undefined,
      actorId: userId,
      action: 'auth.logout',
      ipAddress,
      userAgent,
    });
  },

  // ── Logout All ───────────────────────────────────────────────────────────
  async logoutAll(
    userId: string,
    facilityId: string | null,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    await revokeAllIdentityUserSessions(userId, 'user_logout');
    await incrementIdentityAuthVersion(userId);

    await writeAuthAuditEntry({
      facilityId: facilityId ?? undefined,
      actorId: userId,
      action: 'auth.logout_all',
      ipAddress,
      userAgent,
    });
  },

  // ── Forgot Password ──────────────────────────────────────────────────────
  async forgotPassword(
    dto: ForgotPasswordBody,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    const user = await getIdentityUserByEmail(dto.email);
    if (!user) return; // generic response — don't reveal email existence

    const resetToken = uuidv4();
    await setIdentityPasswordResetToken(user.id, resetToken, addMinutes(new Date(), 30));
    void sendPasswordResetEmail(user.email, user.firstName, resetToken, 'MediSyn');

    await writeAuthAuditEntry({
      actorId: user.id,
      action: 'auth.password_reset_request',
      ipAddress,
      userAgent,
    });
  },

  // ── Reset Password ───────────────────────────────────────────────────────
  async resetPassword(
    dto: ResetPasswordBody,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    const user = await getIdentityUserByPasswordResetToken(dto.token);

    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      throw new AppError('RESET_TOKEN_INVALID', 'Password reset link is invalid or has expired', 400);
    }

    const newHash = await argon2.hash(dto.password);
    await updateIdentityUserPasswordAndVersion(user.id, newHash);
    await clearIdentityPasswordResetToken(user.id);
    await revokeAllIdentityUserSessions(user.id, 'password_changed');

    await writeAuthAuditEntry({
      actorId: user.id,
      action: 'auth.password_reset_complete',
      ipAddress,
      userAgent,
    });
  },

  // ── Verify Email ─────────────────────────────────────────────────────────
  async verifyEmail(dto: VerifyEmailBody): Promise<void> {
    const user = await getIdentityUserByEmailVerifyToken(dto.token);

    if (!user) {
      throw new AppError('VERIFY_TOKEN_INVALID', 'Email verification link is invalid or has expired', 400);
    }

    if (user.emailVerified) return; // idempotent

    if (!user.emailVerifyExpiresAt || user.emailVerifyExpiresAt < new Date()) {
      throw new AppError('VERIFY_TOKEN_INVALID', 'Email verification link has expired', 400);
    }

    await clearIdentityEmailVerifyTokenAndMarkVerified(user.id);

    await writeAuthAuditEntry({
      actorId: user.id,
      action: 'auth.email_verify',
    });
  },

  // ── Super Admin Login ────────────────────────────────────────────────────
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
      isSuperAdmin: boolean;
      roles: string[];
      permissions: string[];
    };
  }> {
    const user = await getIdentityUserByEmail(dto.email);
    if (!user || user.accountType !== 'super_admin') {
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

    // Optional facility context for scoped super-admin work
    let resolvedFacilityId: string | null = null;
    if (dto.facilitySlug) {
      const facility = await getFacilityBySlug(dto.facilitySlug);
      if (!facility) {
        throw new AppError('FACILITY_NOT_FOUND', `Facility '${dto.facilitySlug}' not found`, 404);
      }
      if (facility.status === 'suspended' || facility.status === 'deactivated') {
        throw new AppError('FACILITY_SUSPENDED', 'That facility is currently suspended', 403);
      }
      resolvedFacilityId = facility.id;
    }

    const sessionId = uuidv4();
    const rawRefreshToken = randomBytes(32).toString('hex');
    const refreshTokenHash = await argon2.hash(rawRefreshToken);

    await createIdentitySession({
      id: sessionId,
      userId: user.id,
      facilityId: resolvedFacilityId,
      refreshTokenHash,
      userAgent,
      ipAddress,
      expiresAt: addDays(new Date(), 30),
    });

    const accessToken = signAccessToken({
      sub: user.id,
      sessionId,
      accountType: 'super_admin',
      healthProfessionalId: null,
      facilityId: resolvedFacilityId,
      facilityPrefix: null,
      authVersion: user.authVersion,
      roles: ['super_admin'],
      permissions: ['*'],
    });

    await updateIdentityLastLoginAt(user.id);

    await writeAuthAuditEntry({
      actorId: user.id,
      action: 'auth.super_admin_login',
      facilityId: resolvedFacilityId ?? undefined,
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      rawRefreshToken,
      user: {
        id:           user.id,
        email:        user.email,
        firstName:    user.firstName,
        lastName:     user.lastName,
        isSuperAdmin: true,
        roles:        ['super_admin'],
        permissions:  ['*'],
      },
    };
  },

  // ── Get Me ───────────────────────────────────────────────────────────────
  async getMe(userId: string, facilityId: string | null, accountType: string): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    emailVerified: boolean;
    accountType: string;
    facilityId: string | null;
    healthProfessionalId: string | null;
    roles: string[];
    permissions: string[];
  }> {
    const user = await getIdentityUserById(userId);
    if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

    let healthProfessionalId: string | null = null;
    let roles: string[] = [];
    let permissions: string[] = [];

    if (accountType === 'super_admin') {
      roles = ['super_admin'];
      permissions = ['*'];
    } else if (accountType === 'facility_user') {
      const auth = await resolveHealthProfessionalAuth(userId);
      if (auth) {
        healthProfessionalId = auth.healthProfessionalId;
        roles = auth.roles;
        permissions = auth.permissions;
      }
    } else if (accountType === 'patient') {
      roles = ['patient'];
    }

    return {
      id:                  user.id,
      email:               user.email,
      firstName:           user.firstName,
      lastName:            user.lastName,
      emailVerified:       user.emailVerified,
      accountType:         user.accountType,
      facilityId,
      healthProfessionalId,
      roles,
      permissions,
    };
  },

  // ── Resend Verification ──────────────────────────────────────────────────
  async resendVerification(
    dto: ResendVerificationBody,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    const user = await getIdentityUserByEmail(dto.email);
    if (!user || user.emailVerified) return;

    const newToken = uuidv4();
    await setIdentityEmailVerifyToken(user.id, newToken, addHours(new Date(), 24));
    void sendVerificationEmail(user.email, user.firstName, newToken, 'MediSyn');

    await writeAuthAuditEntry({
      actorId: user.id,
      action: 'auth.email_verify_resend',
      ipAddress,
      userAgent,
    });
  },
};
