-- ==============================================================================
-- 01_init_schema.sql
-- Create "sales-pipe" schema and grant permissions
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS "sales-pipe";

-- Grant usage and permissions to Supabase roles
GRANT USAGE ON SCHEMA "sales-pipe" TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA "sales-pipe" TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA "sales-pipe" TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA "sales-pipe" TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA "sales-pipe" GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA "sales-pipe" GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA "sales-pipe" GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
