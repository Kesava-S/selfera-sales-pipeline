-- ==============================================================================
-- 27_v2_settings.sql
-- Settings screen: my name, team management (admin) and follow-up timing
-- (admin). All changes go through checked functions. Safe to re-run. Run after 26.
-- Inviting people and blocking log-in happen in the app with the service key.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

-- 1. Writes only through the functions below
DROP POLICY IF EXISTS "Profiles manage admin" ON "sales-pipe".profiles;
DROP POLICY IF EXISTS "Cadence write admin" ON "sales-pipe".cadence_rules;
REVOKE UPDATE ON "sales-pipe".cadence_rules FROM authenticated;

-- 2. My name (anyone with an active account). Used in message drafts.
CREATE OR REPLACE FUNCTION "sales-pipe".set_my_name(p_full_name text)
RETURNS void AS $$
BEGIN
    IF "sales-pipe".get_user_role() IS NULL THEN RAISE EXCEPTION 'Your account is not set up'; END IF;
    IF length(trim(coalesce(p_full_name, ''))) < 2 THEN RAISE EXCEPTION 'Enter your name'; END IF;
    UPDATE "sales-pipe".profiles SET full_name = trim(p_full_name) WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

-- 3. Change a team member (admin only)
CREATE OR REPLACE FUNCTION "sales-pipe".update_member(
    p_id uuid,
    p_full_name text,
    p_role text,
    p_capacity integer,
    p_active boolean
) RETURNS void AS $$
DECLARE
    v_old record;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin']);

    SELECT * INTO v_old FROM "sales-pipe".profiles WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Person not found'; END IF;

    IF length(trim(coalesce(p_full_name, ''))) < 2 THEN RAISE EXCEPTION 'Enter their name'; END IF;
    IF p_role NOT IN ('admin', 'sales', 'consultant') THEN RAISE EXCEPTION 'Unknown role'; END IF;
    IF p_capacity IS NOT NULL AND (p_capacity < 1 OR p_capacity > 1000) THEN
        RAISE EXCEPTION 'Active leads must be between 1 and 1000';
    END IF;

    -- Never lock yourself out, and always keep one active admin
    IF p_id = auth.uid() AND (p_role <> 'admin' OR NOT p_active) THEN
        RAISE EXCEPTION 'You cannot remove your own admin access';
    END IF;
    IF v_old.role = 'admin' AND v_old.is_active AND (p_role <> 'admin' OR NOT p_active)
       AND NOT EXISTS (SELECT 1 FROM "sales-pipe".profiles WHERE role = 'admin' AND is_active AND id <> p_id) THEN
        RAISE EXCEPTION 'There must always be at least one admin';
    END IF;

    UPDATE "sales-pipe".profiles
    SET full_name = trim(p_full_name),
        role = p_role,
        capacity = coalesce(p_capacity, capacity),
        is_active = p_active
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

-- 4. Follow-up timing in working days (admin only)
CREATE OR REPLACE FUNCTION "sales-pipe".set_cadence(p_step_name text, p_days integer)
RETURNS void AS $$
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin']);
    IF p_step_name NOT IN ('Follow up 1', 'Follow up 2', 'Follow up 3') THEN RAISE EXCEPTION 'Unknown step'; END IF;
    IF p_days IS NULL OR p_days < 1 OR p_days > 60 THEN RAISE EXCEPTION 'Pick between 1 and 60 working days'; END IF;
    UPDATE "sales-pipe".cadence_rules SET days_delay = p_days, updated_at = now() WHERE step_name = p_step_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

-- 5. Access
REVOKE EXECUTE ON FUNCTION "sales-pipe".set_my_name(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION "sales-pipe".update_member(uuid, text, text, integer, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION "sales-pipe".set_cadence(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "sales-pipe".set_my_name(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe".update_member(uuid, text, text, integer, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe".set_cadence(text, integer) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
