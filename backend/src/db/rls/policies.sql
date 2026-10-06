-- RLS policies for all facility-scoped tables.
-- Run AFTER migrations and AFTER create-roles.sql.
-- Requires current_facility_id() function (current-facility-id.sql).
--
-- Facility-scoped tables (9):
--   sessions, facility_module_overrides, facility_entitlement_overrides,
--   facility_usage_records, facility_roles, facility_role_permissions,
--   facility_users, audit_log, patient_profiles

-- ── sessions ──────────────────────────────────────────────────────────────

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON sessions;
CREATE POLICY tenant_isolation ON sessions
  USING (facility_id = current_facility_id())
  WITH CHECK (facility_id = current_facility_id());

-- ── facility_module_overrides ─────────────────────────────────────────────

ALTER TABLE facility_module_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON facility_module_overrides;
CREATE POLICY tenant_isolation ON facility_module_overrides
  USING (facility_id = current_facility_id())
  WITH CHECK (facility_id = current_facility_id());

-- ── facility_entitlement_overrides ────────────────────────────────────────

ALTER TABLE facility_entitlement_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON facility_entitlement_overrides;
CREATE POLICY tenant_isolation ON facility_entitlement_overrides
  USING (facility_id = current_facility_id())
  WITH CHECK (facility_id = current_facility_id());

-- ── facility_usage_records ────────────────────────────────────────────────

ALTER TABLE facility_usage_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON facility_usage_records;
CREATE POLICY tenant_isolation ON facility_usage_records
  USING (facility_id = current_facility_id())
  WITH CHECK (facility_id = current_facility_id());

-- ── facility_roles ────────────────────────────────────────────────────────

ALTER TABLE facility_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON facility_roles;
CREATE POLICY tenant_isolation ON facility_roles
  USING (facility_id = current_facility_id())
  WITH CHECK (facility_id = current_facility_id());

-- ── facility_role_permissions ─────────────────────────────────────────────

ALTER TABLE facility_role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON facility_role_permissions;
CREATE POLICY tenant_isolation ON facility_role_permissions
  USING (facility_id = current_facility_id())
  WITH CHECK (facility_id = current_facility_id());

-- ── facility_users ────────────────────────────────────────────────────────

ALTER TABLE facility_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON facility_users;
CREATE POLICY tenant_isolation ON facility_users
  USING (facility_id = current_facility_id())
  WITH CHECK (facility_id = current_facility_id());

-- ── audit_log ─────────────────────────────────────────────────────────────
-- Special: separate FOR SELECT and FOR INSERT policies.
-- app_user can SELECT own facility's records (NULL facility_id = platform events, visible to super admin only).
-- app_super_admin bypasses RLS entirely.
-- No UPDATE or DELETE policy — operations are revoked at DB level.

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_select ON audit_log;
CREATE POLICY tenant_isolation_select ON audit_log
  FOR SELECT
  USING (facility_id = current_facility_id());

DROP POLICY IF EXISTS tenant_isolation_insert ON audit_log;
CREATE POLICY tenant_isolation_insert ON audit_log
  FOR INSERT
  WITH CHECK (
    facility_id IS NULL OR facility_id = current_facility_id()
  );

-- ── patient_profiles ──────────────────────────────────────────────────────

ALTER TABLE patient_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON patient_profiles;
CREATE POLICY tenant_isolation ON patient_profiles
  USING (facility_id = current_facility_id())
  WITH CHECK (facility_id = current_facility_id());
