import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

// ── Enums ─────────────────────────────────────────────────────────────────

export const accountTypeEnum = pgEnum('account_type', [
  'super_admin',
  'facility_user',
  'patient',
]);

// ── users ─────────────────────────────────────────────────────────────────
// Single source of truth for every human who can authenticate.
// facility_prefix = the owning facility's short prefix (e.g. 'med').
// username        = fully-qualified: {facility_prefix}{chosen_name} (e.g. 'medjohn').
// super_admin accounts have facility_prefix = NULL and username = email-derived.

export const identityUsers = pgTable(
  'users',
  {
    id:                    uuid('id').primaryKey().defaultRandom(),
    email:                 text('email').notNull().unique(),
    // fully-qualified, e.g. "medjohn" (prefix + local name chosen at registration)
    username:              text('username').notNull().unique(),
    // lowercase-normalised copy — uniqueness enforced here, not on username
    normalizedUsername:    text('normalized_username').notNull().unique(),
    passwordHash:          text('password_hash').notNull(),
    firstName:             text('first_name').notNull(),
    lastName:              text('last_name').notNull(),
    phone:                 text('phone'),
    accountType:           accountTypeEnum('account_type').notNull().default('facility_user'),
    // short prefix of the facility this user belongs to (NULL for super_admin)
    facilityPrefix:        text('facility_prefix'),
    emailVerified:         boolean('email_verified').notNull().default(false),
    emailVerifyToken:      text('email_verify_token'),
    emailVerifyExpiresAt:  timestamp('email_verify_expires_at', { withTimezone: true }),
    passwordResetToken:    text('password_reset_token'),
    passwordResetExpiresAt: timestamp('password_reset_expires_at', { withTimezone: true }),
    isActive:              boolean('is_active').notNull().default(true),
    // Incremented on password change or force-logout to invalidate all active JWTs
    authVersion:           integer('auth_version').notNull().default(1),
    lastLoginAt:           timestamp('last_login_at', { withTimezone: true }),
    createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('identity_users_email_idx').on(t.email),
    index('identity_users_norm_username_idx').on(t.normalizedUsername),
    index('identity_users_facility_prefix_idx').on(t.facilityPrefix),
    index('identity_users_account_type_idx').on(t.accountType),
  ],
);

// ── sessions ──────────────────────────────────────────────────────────────
// Auth sessions live in the identity DB so login/logout never touches vtech-core.
// facility_id stored as text — no DB-level FK to vtech-core (cross-DB).

export const identitySessions = pgTable(
  'sessions',
  {
    id:               uuid('id').primaryKey().defaultRandom(),
    userId:           uuid('user_id').notNull().references(() => identityUsers.id, { onDelete: 'cascade' }),
    // UUID of the facility in vtech-core (text, app-level FK)
    facilityId:       text('facility_id'),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    userAgent:        text('user_agent'),
    ipAddress:        text('ip_address'),
    // Non-null = revoked
    revokedAt:        timestamp('revoked_at', { withTimezone: true }),
    // enum: user_logout | admin_revoked | facility_suspended | password_changed | rotated
    revokedReason:    text('revoked_reason'),
    expiresAt:        timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt:       timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('identity_sessions_user_idx').on(t.userId),
    index('identity_sessions_facility_idx').on(t.facilityId),
  ],
);

// ── Type exports ──────────────────────────────────────────────────────────

export type IdentityUser    = typeof identityUsers.$inferSelect;
export type NewIdentityUser = typeof identityUsers.$inferInsert;
export type IdentitySession    = typeof identitySessions.$inferSelect;
export type NewIdentitySession = typeof identitySessions.$inferInsert;
