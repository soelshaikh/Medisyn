-- Vtech-Med: PostgreSQL role setup
-- Run once as a privileged user (e.g. postgres or vtechmed admin role)
-- before running Drizzle migrations.
--
-- Connection strings:
--   app_user_login  → DATABASE_URL
--   app_super_admin_login → DATABASE_SUPER_ADMIN_URL

-- ── Application roles (NOLOGIN — inherit via login roles) ─────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_super_admin') THEN
    CREATE ROLE app_super_admin
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
      BYPASSRLS;
  END IF;
END
$$;

-- ── Login roles (INHERIT — pick up permissions from application role) ──────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user_login') THEN
    -- Password must be changed before production use
    CREATE ROLE app_user_login
      LOGIN INHERIT PASSWORD 'app_user_pass_CHANGE_ME';
  END IF;
  GRANT app_user TO app_user_login;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_super_admin_login') THEN
    -- Password must be changed before production use
    -- BYPASSRLS must be on the login role directly; it is NOT inherited via membership.
    CREATE ROLE app_super_admin_login
      LOGIN INHERIT BYPASSRLS PASSWORD 'super_admin_pass_CHANGE_ME';
  END IF;
  GRANT app_super_admin TO app_super_admin_login;
END
$$;

-- ── Schema access ──────────────────────────────────────────────────────────

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO app_user, app_super_admin;

-- ── Future table grants (applied to tables created after this script) ──────

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_super_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_super_admin;
