-- current_facility_id() — returns the tenant context set by withTenantContext()
-- Fail-closed: raises an exception (not NULL) when context is absent or invalid.
-- Used in all RLS policies on facility-scoped tables.

CREATE OR REPLACE FUNCTION current_facility_id() RETURNS UUID AS $$
DECLARE
  v_raw TEXT;
BEGIN
  v_raw := current_setting('app.current_facility_id', true);

  IF v_raw IS NULL OR v_raw = '' THEN
    RAISE EXCEPTION
      'tenant context not set: app.current_facility_id is missing'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN v_raw::UUID;

EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION
      'tenant context invalid: app.current_facility_id is not a valid UUID: %', v_raw
      USING ERRCODE = 'P0002';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
