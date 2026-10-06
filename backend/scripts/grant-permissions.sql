-- Grant table permissions to application roles.
-- Run after every migration (or configure as ALTER DEFAULT PRIVILEGES).
-- Must be run as the database owner or a superuser.

-- Grant all standard operations to both roles
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO app_user, app_super_admin;

GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA public
  TO app_user, app_super_admin;

-- audit_log is APPEND-ONLY — revoke UPDATE and DELETE from ALL roles
-- This applies even to app_super_admin (no exceptions)
REVOKE UPDATE, DELETE ON audit_log FROM app_user;
REVOKE UPDATE, DELETE ON audit_log FROM app_super_admin;

-- Ensure future tables get the same grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_super_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_super_admin;
