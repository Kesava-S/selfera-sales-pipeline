-- ==============================================================================
-- 29_v2_fix_user_role.sql
-- Fix get_user_role() to properly recognize service_role as admin
-- Ensures analytics / insights calculations can run seamlessly in all environments.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

CREATE OR REPLACE FUNCTION "sales-pipe".get_user_role()
RETURNS text AS $$
    SELECT CASE 
        WHEN auth.role() = 'service_role' THEN 'admin'
        ELSE (SELECT role FROM "sales-pipe".profiles WHERE id = auth.uid() AND is_active = true)
    END;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

GRANT EXECUTE ON FUNCTION "sales-pipe".get_user_role() TO authenticated, anon, service_role;
