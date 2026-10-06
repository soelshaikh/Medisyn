import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  bigserial,
  index,
} from 'drizzle-orm/pg-core';

// ── audit_log ─────────────────────────────────────────────────────────────
// Append-only. UPDATE and DELETE are REVOKEd at DB level for all roles.
// RLS: app_user can SELECT/INSERT only their own facility_id.
// app_super_admin bypasses RLS.

export const auditLog = pgTable(
  'audit_log',
  {
    // BIGSERIAL for monotonic ordering
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    // NULL for platform-level events
    facilityId: uuid('facility_id'),
    // NULL for system events
    actorId: uuid('actor_id'),
    // enum: user | system | api_key
    actorType: text('actor_type').notNull(),
    // format: {domain}.{event} e.g. auth.login, session.revoke
    action: text('action').notNull(),
    resourceType: text('resource_type'),
    resourceId: text('resource_id'),
    // Event-specific details — never raw PHI
    metadata: jsonb('metadata').notNull().default({}),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_log_facility_created_idx').on(t.facilityId, t.createdAt),
    index('audit_log_actor_idx').on(t.actorId),
    index('audit_log_action_idx').on(t.action),
    index('audit_log_resource_idx').on(t.resourceType, t.resourceId),
  ],
);
