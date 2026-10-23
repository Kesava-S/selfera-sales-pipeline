-- ==============================================================================
-- 01_init_schema.sql
-- Initialize "sales-pipe" schema, permissions, extensions, and helper functions
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS "sales-pipe";

-- Permissions
GRANT USAGE ON SCHEMA "sales-pipe" TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA "sales-pipe" TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA "sales-pipe" TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA "sales-pipe" TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA "sales-pipe" GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA "sales-pipe" GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA "sales-pipe" GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- Helper function: get_user_role()
CREATE OR REPLACE FUNCTION "sales-pipe".get_user_role()
RETURNS text AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role
    FROM "sales-pipe".profiles
    WHERE id = auth.uid() AND is_active = true;
    RETURN v_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'sales-pipe', 'public';

-- Helper function: require_role(text[])
CREATE OR REPLACE FUNCTION "sales-pipe".require_role(required_roles text[])
RETURNS void AS $$
DECLARE
    v_role text;
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN;
    END IF;
    v_role := "sales-pipe".get_user_role();
    IF v_role IS NULL OR NOT (v_role = ANY(required_roles)) THEN
        RAISE EXCEPTION 'Forbidden: insufficient role "%"', coalesce(v_role, 'none');
    END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'sales-pipe', 'public';
