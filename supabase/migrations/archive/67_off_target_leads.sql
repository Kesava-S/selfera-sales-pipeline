-- ==============================================================================
-- 67_off_target_leads.sql
-- Off-target leads: businesses reached during outreach or campaigns that turn
-- out to be unrelated to us (not our field, not our business type, wrong
-- contact) or found not to fit at follow-up / consultation.
--
-- * Marked and undone by staff only (never automatic). The stage is untouched,
--   so Undo puts the lead back exactly as it was.
-- * Off-target leads stay in Lead Management (labelled) but are left out of the
--   pipeline status counts and lists, Due today, follow-ups and new campaigns.
-- * Replaces the "Unmatched bookings" dashboard box (no booking form is used).
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

ALTER TABLE "sales-pipe".businesses
    ADD COLUMN IF NOT EXISTS off_target_at timestamptz,
    ADD COLUMN IF NOT EXISTS off_target_reason text,
    ADD COLUMN IF NOT EXISTS off_target_noticed text,
    ADD COLUMN IF NOT EXISTS off_target_note text,
    ADD COLUMN IF NOT EXISTS off_target_by uuid REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL;

ALTER TABLE "sales-pipe".businesses DROP CONSTRAINT IF EXISTS businesses_off_target_reason_check;
ALTER TABLE "sales-pipe".businesses ADD CONSTRAINT businesses_off_target_reason_check
    CHECK (off_target_reason IS NULL OR off_target_reason IN ('unrelated', 'wrong_type', 'wrong_contact', 'not_a_fit'));
ALTER TABLE "sales-pipe".businesses DROP CONSTRAINT IF EXISTS businesses_off_target_noticed_check;
ALTER TABLE "sales-pipe".businesses ADD CONSTRAINT businesses_off_target_noticed_check
    CHECK (off_target_noticed IS NULL OR off_target_noticed IN ('outreach', 'campaign', 'follow_up', 'consultation'));

CREATE INDEX IF NOT EXISTS businesses_off_target_idx ON "sales-pipe".businesses (off_target_at) WHERE off_target_at IS NOT NULL;

-- Can this person change these leads? Admin: any. Others: leads they can work on.
CREATE OR REPLACE FUNCTION "sales-pipe".can_mark_leads(p_business_ids uuid[])
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
BEGIN
    IF v_role = 'admin' OR auth.role() = 'service_role' THEN RETURN true; END IF;
    IF v_role IS NULL THEN RETURN false; END IF;
    RETURN NOT EXISTS (
        SELECT 1 FROM unnest(p_business_ids) bid
        WHERE NOT EXISTS (
            SELECT 1 FROM "sales-pipe".opportunities o
            WHERE o.business_id = bid
              AND (o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
                   OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION "sales-pipe".mark_off_target(p_business_ids uuid[], p_reason text, p_noticed text, p_note text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v_count int;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales', 'consultant']);
    IF p_reason IS NULL OR p_reason NOT IN ('unrelated', 'wrong_type', 'wrong_contact', 'not_a_fit') THEN
        RAISE EXCEPTION 'Pick a reason.';
    END IF;
    IF p_noticed IS NULL OR p_noticed NOT IN ('outreach', 'campaign', 'follow_up', 'consultation') THEN
        RAISE EXCEPTION 'Pick where it was noticed.';
    END IF;
    IF NOT "sales-pipe".can_mark_leads(p_business_ids) THEN
        RAISE EXCEPTION 'You can only mark leads you work on.';
    END IF;

    UPDATE "sales-pipe".businesses SET
        off_target_at = now(),
        off_target_reason = p_reason,
        off_target_noticed = p_noticed,
        off_target_note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
        off_target_by = auth.uid()
    WHERE id = ANY(p_business_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;

    INSERT INTO "sales-pipe".user_logs (user_id, user_name, action, entity_type, entity_id, details)
    SELECT auth.uid()::text, p.full_name, 'lead_off_target', 'business', b.id::text,
           jsonb_build_object('reason', p_reason, 'noticed', p_noticed)
    FROM "sales-pipe".businesses b
    LEFT JOIN "sales-pipe".profiles p ON p.id = auth.uid()
    WHERE b.id = ANY(p_business_ids);

    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION "sales-pipe".clear_off_target(p_business_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v_count int;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales', 'consultant']);
    IF NOT "sales-pipe".can_mark_leads(p_business_ids) THEN
        RAISE EXCEPTION 'You can only change leads you work on.';
    END IF;

    UPDATE "sales-pipe".businesses SET
        off_target_at = NULL, off_target_reason = NULL, off_target_noticed = NULL,
        off_target_note = NULL, off_target_by = NULL
    WHERE id = ANY(p_business_ids) AND off_target_at IS NOT NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;

    INSERT INTO "sales-pipe".user_logs (user_id, user_name, action, entity_type, entity_id, details)
    SELECT auth.uid()::text, p.full_name, 'lead_off_target_undone', 'business', b.id::text, '{}'::jsonb
    FROM "sales-pipe".businesses b
    LEFT JOIN "sales-pipe".profiles p ON p.id = auth.uid()
    WHERE b.id = ANY(p_business_ids);

    RETURN v_count;
END;
$$;

-- The Off-target leads list (same visibility as the dashboard boxes)
CREATE OR REPLACE FUNCTION "sales-pipe".list_off_target_leads()
RETURNS TABLE(business_id uuid, business_name text, business_type text, area text, opportunity_id uuid, stage text,
              reason text, noticed text, note text, marked_at timestamptz, marked_by_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
BEGIN
    IF v_role IS NULL AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Your account is not set up';
    END IF;
    RETURN QUERY
    SELECT b.id, b.business_name, "sales-pipe".canonical_business_type(b.business_type), b.area,
           o.id, o.stage, b.off_target_reason, b.off_target_noticed, b.off_target_note,
           b.off_target_at, p.full_name
    FROM "sales-pipe".businesses b
    JOIN LATERAL (
        SELECT o2.id, o2.stage FROM "sales-pipe".opportunities o2
        WHERE o2.business_id = b.id
          AND (v_role = 'admin' OR auth.role() = 'service_role'
               OR o2.assigned_sales_id = v_uid OR o2.assigned_consultant_id = v_uid
               OR (v_role = 'sales' AND o2.assigned_sales_id IS NULL AND o2.assigned_consultant_id IS NULL))
        ORDER BY o2.created_at DESC LIMIT 1
    ) o ON true
    LEFT JOIN "sales-pipe".profiles p ON p.id = b.off_target_by
    WHERE b.off_target_at IS NOT NULL AND NOT b.archived
    ORDER BY b.off_target_at DESC
    LIMIT 1000;
END;
$$;

-- Dashboard boxes: "Off-target leads" replaces "Unmatched bookings"; the
-- pipeline boxes leave off-target leads out. Lead Management totals keep them.
DROP FUNCTION IF EXISTS "sales-pipe".v_dashboard_status_counts(uuid);
CREATE FUNCTION "sales-pipe".v_dashboard_status_counts(p_user uuid)
RETURNS TABLE(needs_reply bigint, interested bigint, consultation bigint, went_cold bigint, no_response bigint,
              needs_consultant bigint, off_target bigint, needs_review bigint, total_pitches bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v_role text;
BEGIN
    IF auth.role() <> 'service_role' AND p_user IS DISTINCT FROM auth.uid()
       AND coalesce("sales-pipe".get_user_role(), '') <> 'admin' THEN
        RAISE EXCEPTION 'You can only see your own numbers';
    END IF;
    SELECT role INTO v_role FROM "sales-pipe".profiles WHERE id = p_user;

    RETURN QUERY
    WITH visible AS (
        SELECT o.*, b.problems, b.off_target_at FROM "sales-pipe".opportunities o
        JOIN "sales-pipe".businesses b ON b.id = o.business_id AND NOT b.archived
        WHERE v_role = 'admin' OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user
           OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
    ),
    mine AS (SELECT * FROM visible WHERE off_target_at IS NULL)
    SELECT
        (SELECT count(DISTINCT m.id) FROM mine m JOIN "sales-pipe".threads t ON t.opportunity_id = m.id
          WHERE m.stage IN ('Active', 'Interested', 'Consultation') AND t.status = 'Replied'
            AND t.last_inbound_at > coalesce(t.last_outbound_at, '-infinity')),
        (SELECT count(*) FROM mine WHERE stage = 'Interested'),
        (SELECT count(*) FROM mine WHERE stage = 'Consultation'),
        (SELECT count(*) FROM mine WHERE stage = 'Went cold'),
        (SELECT count(*) FROM mine WHERE stage = 'No response'),
        (CASE WHEN v_role = 'admin' THEN (SELECT count(*) FROM mine WHERE stage = 'Consultation' AND assigned_consultant_id IS NULL) ELSE 0 END),
        (SELECT count(DISTINCT business_id) FROM visible WHERE off_target_at IS NOT NULL),
        (SELECT count(*) FROM visible WHERE stage = 'Needs review' AND problems = '{}'::text[]),
        (SELECT count(*) FROM visible);
END;
$$;

-- Pipeline lists, Due today, follow-ups and campaign launch leave off-target leads out

CREATE OR REPLACE FUNCTION "sales-pipe".status_type_counts(p_status text)
 RETURNS TABLE(business_type text, count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
    v_status text := lower(trim(replace(replace(coalesce(p_status, ''), '_', '-'), ' ', '-')));
BEGIN
    IF v_role IS NULL AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Your account is not set up';
    END IF;

    RETURN QUERY
    WITH types AS (
        SELECT unnest(ARRAY['Hotel', 'Restaurant or cafe', 'Pub', 'Property management']) AS b_type
    ),
    matching_opps AS (
        SELECT o.id, "sales-pipe".canonical_business_type(b.business_type) AS c_type
        FROM "sales-pipe".opportunities o
        JOIN "sales-pipe".businesses b ON b.id = o.business_id
        WHERE NOT b.archived AND b.off_target_at IS NULL
          AND (v_role = 'admin' OR auth.role() = 'service_role'
               OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
               OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
          AND (
              (v_status IN ('needs-reply', 'needsreply') AND o.stage IN ('Active', 'Interested', 'Consultation') AND EXISTS (
                  SELECT 1 FROM "sales-pipe".threads t
                  WHERE t.opportunity_id = o.id AND t.status = 'Replied'
                    AND t.last_inbound_at > coalesce(t.last_outbound_at, '-infinity')
              ))
              OR (v_status = 'interested' AND o.stage = 'Interested')
              OR (v_status = 'consultation' AND o.stage = 'Consultation')
              OR (v_status IN ('needs-consultant', 'needsconsultant') AND v_role = 'admin' AND o.stage = 'Consultation' AND o.assigned_consultant_id IS NULL)
              OR (v_status IN ('went-cold', 'wentcold') AND o.stage = 'Went cold')
              OR (v_status IN ('no-response', 'noresponse') AND o.stage = 'No response')
          )
    )
    SELECT t.b_type AS business_type, count(m.id)::bigint AS count
    FROM types t
    LEFT JOIN matching_opps m ON m.c_type = t.b_type
    GROUP BY t.b_type
    ORDER BY array_position(ARRAY['Hotel', 'Restaurant or cafe', 'Pub', 'Property management'], t.b_type);
END;
$fn$;

CREATE OR REPLACE FUNCTION "sales-pipe".status_list(p_status text, p_type text DEFAULT NULL::text, p_platform text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(opportunity_id uuid, business_id uuid, business_name text, business_type text, thread_id uuid, platform text, latest_message text, last_inbound_at timestamp with time zone, consultation_at timestamp with time zone, consultant_id uuid, consultant_name text, last_contact_at timestamp with time zone, platforms_tried text[], total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
    v_status text := lower(trim(replace(replace(coalesce(p_status, ''), '_', '-'), ' ', '-')));
BEGIN
    IF v_role IS NULL AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Your account is not set up';
    END IF;

    -- Needs reply flow
    IF v_status IN ('needs-reply', 'needsreply') THEN
        RETURN QUERY
        WITH rows AS (
            SELECT
                o.id AS r_opportunity_id,
                b.id AS r_business_id,
                b.business_name AS r_business_name,
                "sales-pipe".canonical_business_type(b.business_type) AS r_business_type,
                t.id AS r_thread_id,
                t.platform AS r_platform,
                (SELECT regexp_replace(replace(replace(m.body, E'\r', ' '), E'\n', ' '), '\s+', ' ', 'g')
                 FROM "sales-pipe".messages m
                 WHERE m.thread_id = t.id AND m.direction = 'inbound'
                 ORDER BY m.created_at DESC LIMIT 1) AS r_latest_message,
                t.last_inbound_at AS r_last_inbound_at,
                NULL::timestamptz AS r_consultation_at,
                NULL::uuid AS r_consultant_id,
                NULL::text AS r_consultant_name,
                NULL::timestamptz AS r_last_contact_at,
                NULL::text[] AS r_platforms_tried
            FROM "sales-pipe".threads t
            JOIN "sales-pipe".opportunities o ON o.id = t.opportunity_id
            JOIN "sales-pipe".businesses b ON b.id = o.business_id
            WHERE NOT b.archived AND b.off_target_at IS NULL
              AND o.stage IN ('Active', 'Interested', 'Consultation')
              AND t.status = 'Replied'
              AND t.last_inbound_at > coalesce(t.last_outbound_at, '-infinity')
              AND (v_role = 'admin' OR auth.role() = 'service_role'
                   OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
                   OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
              AND (nullif(p_type, '') IS NULL OR "sales-pipe".canonical_business_type(b.business_type) = "sales-pipe".canonical_business_type(p_type))
              AND (nullif(p_platform, '') IS NULL OR lower(t.platform) = lower(p_platform))
            ORDER BY t.last_inbound_at ASC
        )
        SELECT
            r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type,
            r.r_thread_id, r.r_platform, r.r_latest_message, r.r_last_inbound_at,
            r.r_consultation_at, r.r_consultant_id, r.r_consultant_name,
            r.r_last_contact_at, r.r_platforms_tried,
            count(*) OVER () AS total_count
        FROM rows r
        LIMIT least(coalesce(p_limit, 25), 100) OFFSET greatest(coalesce(p_offset, 0), 0);
        RETURN;
    END IF;

    -- Interested flow
    IF v_status = 'interested' THEN
        RETURN QUERY
        WITH rows AS (
            SELECT
                o.id AS r_opportunity_id,
                b.id AS r_business_id,
                b.business_name AS r_business_name,
                "sales-pipe".canonical_business_type(b.business_type) AS r_business_type,
                NULL::uuid AS r_thread_id,
                coalesce(
                    (SELECT t.platform FROM "sales-pipe".threads t WHERE t.opportunity_id = o.id AND t.status = 'Replied' ORDER BY t.last_inbound_at DESC NULLS LAST LIMIT 1),
                    (SELECT t.platform FROM "sales-pipe".threads t WHERE t.opportunity_id = o.id AND t.last_inbound_at IS NOT NULL ORDER BY t.last_inbound_at DESC NULLS LAST LIMIT 1),
                    (SELECT t.platform FROM "sales-pipe".threads t WHERE t.opportunity_id = o.id ORDER BY t.created_at ASC LIMIT 1)
                ) AS r_platform,
                NULL::text AS r_latest_message,
                coalesce(
                    (SELECT max(t.last_inbound_at) FROM "sales-pipe".threads t WHERE t.opportunity_id = o.id),
                    (SELECT max(sc.created_at) FROM "sales-pipe".stage_changes sc WHERE sc.opportunity_id = o.id AND sc.to_stage = 'Interested'),
                    o.created_at
                ) AS r_last_inbound_at,
                NULL::timestamptz AS r_consultation_at,
                NULL::uuid AS r_consultant_id,
                NULL::text AS r_consultant_name,
                NULL::timestamptz AS r_last_contact_at,
                NULL::text[] AS r_platforms_tried
            FROM "sales-pipe".opportunities o
            JOIN "sales-pipe".businesses b ON b.id = o.business_id
            WHERE NOT b.archived AND b.off_target_at IS NULL
              AND o.stage = 'Interested'
              AND (v_role = 'admin' OR auth.role() = 'service_role'
                   OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
                   OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
              AND (nullif(p_type, '') IS NULL OR "sales-pipe".canonical_business_type(b.business_type) = "sales-pipe".canonical_business_type(p_type))
            ORDER BY r_last_inbound_at DESC NULLS LAST, o.created_at DESC
        )
        SELECT
            r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type,
            r.r_thread_id, r.r_platform, r.r_latest_message, r.r_last_inbound_at,
            r.r_consultation_at, r.r_consultant_id, r.r_consultant_name,
            r.r_last_contact_at, r.r_platforms_tried,
            count(*) OVER () AS total_count
        FROM rows r
        LIMIT least(coalesce(p_limit, 25), 100) OFFSET greatest(coalesce(p_offset, 0), 0);
        RETURN;
    END IF;

    -- Consultation flow
    IF v_status = 'consultation' THEN
        RETURN QUERY
        WITH rows AS (
            SELECT
                o.id AS r_opportunity_id,
                b.id AS r_business_id,
                b.business_name AS r_business_name,
                "sales-pipe".canonical_business_type(b.business_type) AS r_business_type,
                NULL::uuid AS r_thread_id,
                NULL::text AS r_platform,
                NULL::text AS r_latest_message,
                NULL::timestamptz AS r_last_inbound_at,
                o.consultation_at AS r_consultation_at,
                o.assigned_consultant_id AS r_consultant_id,
                (SELECT p.full_name FROM "sales-pipe".profiles p WHERE p.id = o.assigned_consultant_id) AS r_consultant_name,
                NULL::timestamptz AS r_last_contact_at,
                NULL::text[] AS r_platforms_tried
            FROM "sales-pipe".opportunities o
            JOIN "sales-pipe".businesses b ON b.id = o.business_id
            WHERE NOT b.archived AND b.off_target_at IS NULL
              AND o.stage = 'Consultation'
              AND (v_role = 'admin' OR auth.role() = 'service_role'
                   OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
                   OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
              AND (nullif(p_type, '') IS NULL OR "sales-pipe".canonical_business_type(b.business_type) = "sales-pipe".canonical_business_type(p_type))
            ORDER BY o.consultation_at ASC NULLS LAST, o.created_at DESC
        )
        SELECT
            r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type,
            r.r_thread_id, r.r_platform, r.r_latest_message, r.r_last_inbound_at,
            r.r_consultation_at, r.r_consultant_id, r.r_consultant_name,
            r.r_last_contact_at, r.r_platforms_tried,
            count(*) OVER () AS total_count
        FROM rows r
        LIMIT least(coalesce(p_limit, 25), 100) OFFSET greatest(coalesce(p_offset, 0), 0);
        RETURN;
    END IF;

    -- Needs consultant flow (admin only)
    IF v_status IN ('needs-consultant', 'needsconsultant') THEN
        IF v_role <> 'admin' AND auth.role() <> 'service_role' THEN
            RETURN;
        END IF;

        RETURN QUERY
        WITH rows AS (
            SELECT
                o.id AS r_opportunity_id,
                b.id AS r_business_id,
                b.business_name AS r_business_name,
                "sales-pipe".canonical_business_type(b.business_type) AS r_business_type,
                NULL::uuid AS r_thread_id,
                NULL::text AS r_platform,
                NULL::text AS r_latest_message,
                NULL::timestamptz AS r_last_inbound_at,
                coalesce(o.consultation_at, o.created_at) AS r_consultation_at,
                NULL::uuid AS r_consultant_id,
                NULL::text AS r_consultant_name,
                NULL::timestamptz AS r_last_contact_at,
                NULL::text[] AS r_platforms_tried
            FROM "sales-pipe".opportunities o
            JOIN "sales-pipe".businesses b ON b.id = o.business_id
            WHERE NOT b.archived AND b.off_target_at IS NULL
              AND o.stage = 'Consultation'
              AND o.assigned_consultant_id IS NULL
              AND (nullif(p_type, '') IS NULL OR "sales-pipe".canonical_business_type(b.business_type) = "sales-pipe".canonical_business_type(p_type))
            ORDER BY o.consultation_at ASC NULLS LAST, o.created_at DESC
        )
        SELECT
            r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type,
            r.r_thread_id, r.r_platform, r.r_latest_message, r.r_last_inbound_at,
            r.r_consultation_at, r.r_consultant_id, r.r_consultant_name,
            r.r_last_contact_at, r.r_platforms_tried,
            count(*) OVER () AS total_count
        FROM rows r
        LIMIT least(coalesce(p_limit, 25), 100) OFFSET greatest(coalesce(p_offset, 0), 0);
        RETURN;
    END IF;

    -- Went cold flow
    IF v_status IN ('went-cold', 'wentcold') THEN
        RETURN QUERY
        WITH rows AS (
            SELECT
                o.id AS r_opportunity_id,
                b.id AS r_business_id,
                b.business_name AS r_business_name,
                "sales-pipe".canonical_business_type(b.business_type) AS r_business_type,
                NULL::uuid AS r_thread_id,
                NULL::text AS r_platform,
                NULL::text AS r_latest_message,
                NULL::timestamptz AS r_last_inbound_at,
                NULL::timestamptz AS r_consultation_at,
                NULL::uuid AS r_consultant_id,
                NULL::text AS r_consultant_name,
                coalesce(
                    (SELECT max(t.last_outbound_at) FROM "sales-pipe".threads t WHERE t.opportunity_id = o.id),
                    (SELECT max(m.created_at) FROM "sales-pipe".threads t JOIN "sales-pipe".messages m ON m.thread_id = t.id WHERE t.opportunity_id = o.id),
                    (SELECT max(sc.created_at) FROM "sales-pipe".stage_changes sc WHERE sc.opportunity_id = o.id AND sc.to_stage = 'Went cold'),
                    o.created_at
                ) AS r_last_contact_at,
                NULL::text[] AS r_platforms_tried
            FROM "sales-pipe".opportunities o
            JOIN "sales-pipe".businesses b ON b.id = o.business_id
            WHERE NOT b.archived AND b.off_target_at IS NULL
              AND o.stage = 'Went cold'
              AND (v_role = 'admin' OR auth.role() = 'service_role'
                   OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
                   OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
              AND (nullif(p_type, '') IS NULL OR "sales-pipe".canonical_business_type(b.business_type) = "sales-pipe".canonical_business_type(p_type))
            ORDER BY r_last_contact_at DESC NULLS LAST, o.created_at DESC
        )
        SELECT
            r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type,
            r.r_thread_id, r.r_platform, r.r_latest_message, r.r_last_inbound_at,
            r.r_consultation_at, r.r_consultant_id, r.r_consultant_name,
            r.r_last_contact_at, r.r_platforms_tried,
            count(*) OVER () AS total_count
        FROM rows r
        LIMIT least(coalesce(p_limit, 25), 100) OFFSET greatest(coalesce(p_offset, 0), 0);
        RETURN;
    END IF;

    -- No response flow
    IF v_status IN ('no-response', 'noresponse') THEN
        RETURN QUERY
        WITH rows AS (
            SELECT
                o.id AS r_opportunity_id,
                b.id AS r_business_id,
                b.business_name AS r_business_name,
                "sales-pipe".canonical_business_type(b.business_type) AS r_business_type,
                NULL::uuid AS r_thread_id,
                NULL::text AS r_platform,
                NULL::text AS r_latest_message,
                NULL::timestamptz AS r_last_inbound_at,
                NULL::timestamptz AS r_consultation_at,
                NULL::uuid AS r_consultant_id,
                NULL::text AS r_consultant_name,
                NULL::timestamptz AS r_last_contact_at,
                coalesce(
                    (SELECT array_agg(DISTINCT t.platform ORDER BY t.platform)
                     FROM "sales-pipe".threads t
                     WHERE t.opportunity_id = o.id AND (t.last_outbound_at IS NOT NULL OR t.step > 0)),
                    (SELECT array_agg(DISTINCT t.platform ORDER BY t.platform)
                     FROM "sales-pipe".threads t
                     WHERE t.opportunity_id = o.id),
                    ARRAY[]::text[]
                ) AS r_platforms_tried
            FROM "sales-pipe".opportunities o
            JOIN "sales-pipe".businesses b ON b.id = o.business_id
            WHERE NOT b.archived AND b.off_target_at IS NULL
              AND o.stage = 'No response'
              AND (v_role = 'admin' OR auth.role() = 'service_role'
                   OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
                   OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
              AND (nullif(p_type, '') IS NULL OR "sales-pipe".canonical_business_type(b.business_type) = "sales-pipe".canonical_business_type(p_type))
            ORDER BY o.created_at DESC
        )
        SELECT
            r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type,
            r.r_thread_id, r.r_platform, r.r_latest_message, r.r_last_inbound_at,
            r.r_consultation_at, r.r_consultant_id, r.r_consultant_name,
            r.r_last_contact_at, r.r_platforms_tried,
            count(*) OVER () AS total_count
        FROM rows r
        LIMIT least(coalesce(p_limit, 25), 100) OFFSET greatest(coalesce(p_offset, 0), 0);
        RETURN;
    END IF;

    -- Fallback for any other stage
    RETURN QUERY
    WITH rows AS (
        SELECT
            o.id AS r_opportunity_id,
            b.id AS r_business_id,
            b.business_name AS r_business_name,
            "sales-pipe".canonical_business_type(b.business_type) AS r_business_type,
            NULL::uuid AS r_thread_id,
            NULL::text AS r_platform,
            NULL::text AS r_latest_message,
            NULL::timestamptz AS r_last_inbound_at,
            NULL::timestamptz AS r_consultation_at,
            NULL::uuid AS r_consultant_id,
            NULL::text AS r_consultant_name,
            NULL::timestamptz AS r_last_contact_at,
            NULL::text[] AS r_platforms_tried
        FROM "sales-pipe".opportunities o
        JOIN "sales-pipe".businesses b ON b.id = o.business_id
        WHERE NOT b.archived AND b.off_target_at IS NULL
          AND (v_role = 'admin' OR auth.role() = 'service_role'
               OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
               OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
          AND (nullif(p_type, '') IS NULL OR "sales-pipe".canonical_business_type(b.business_type) = "sales-pipe".canonical_business_type(p_type))
        ORDER BY o.created_at DESC
    )
    SELECT
        r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type,
        r.r_thread_id, r.r_platform, r.r_latest_message, r.r_last_inbound_at,
        r.r_consultation_at, r.r_consultant_id, r.r_consultant_name,
        r.r_last_contact_at, r.r_platforms_tried,
        count(*) OVER () AS total_count
    FROM rows r
    LIMIT least(coalesce(p_limit, 25), 100) OFFSET greatest(coalesce(p_offset, 0), 0);
END;
$fn$;

CREATE OR REPLACE FUNCTION "sales-pipe".reply_platform_counts(p_type text DEFAULT NULL::text)
 RETURNS TABLE(platform text, count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
BEGIN
    IF v_role IS NULL AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Your account is not set up';
    END IF;

    RETURN QUERY
    WITH platforms AS (
        SELECT unnest(ARRAY['WhatsApp', 'Instagram', 'Facebook', 'Email', 'LinkedIn']) AS p_name
    ),
    matching_threads AS (
        SELECT t.platform
        FROM "sales-pipe".threads t
        JOIN "sales-pipe".opportunities o ON o.id = t.opportunity_id
        JOIN "sales-pipe".businesses b ON b.id = o.business_id
        WHERE NOT b.archived AND b.off_target_at IS NULL
          AND o.stage IN ('Active', 'Interested', 'Consultation')
          AND t.status = 'Replied'
          AND t.last_inbound_at > coalesce(t.last_outbound_at, '-infinity')
          AND (v_role = 'admin' OR auth.role() = 'service_role'
               OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
               OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
          AND (nullif(p_type, '') IS NULL OR "sales-pipe".canonical_business_type(b.business_type) = "sales-pipe".canonical_business_type(p_type))
    )
    SELECT p.p_name AS platform, count(m.platform)::bigint AS count
    FROM platforms p
    LEFT JOIN matching_threads m ON m.platform = p.p_name
    GROUP BY p.p_name
    ORDER BY array_position(ARRAY['WhatsApp', 'Instagram', 'Facebook', 'Email', 'LinkedIn'], p.p_name);
END;
$fn$;

CREATE OR REPLACE FUNCTION "sales-pipe".v_due_today(p_tab text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS TABLE(thread_id uuid, opportunity_id uuid, business_name text, business_type text, platform text, step integer, status text, next_due_on date, last_inbound_at timestamp with time zone, draft_status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
BEGIN
    RETURN QUERY
    SELECT t.id, o.id, b.business_name, b.business_type, t.platform, t.step, t.status, t.next_due_on, t.last_inbound_at,
           (SELECT d.status FROM "sales-pipe".drafts d WHERE d.thread_id = t.id AND d.status IN ('ready', 'needs_data')
             ORDER BY d.created_at DESC LIMIT 1)
    FROM "sales-pipe".threads t
    JOIN "sales-pipe".opportunities o ON o.id = t.opportunity_id
    JOIN "sales-pipe".businesses b ON b.id = o.business_id AND NOT b.archived AND b.off_target_at IS NULL
    WHERE o.stage IN ('Active', 'Interested', 'Consultation')
      AND (v_role = 'admin' OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid)
      AND (
        (p_tab = 'New outreach' AND t.status = 'Not contacted' AND t.next_due_on <= current_date) OR
        (p_tab = 'Follow-ups'   AND t.status = 'Awaiting reply' AND t.next_due_on <= current_date AND t.step < 4) OR
        (p_tab = 'Replies'      AND t.status = 'Replied' AND t.last_inbound_at > coalesce(t.last_outbound_at, '-infinity'))
      )
    ORDER BY t.next_due_on ASC NULLS LAST, t.last_inbound_at ASC NULLS LAST
    LIMIT least(coalesce(p_limit, 100), 500) OFFSET greatest(coalesce(p_offset, 0), 0);
END;
$fn$;

CREATE OR REPLACE FUNCTION "sales-pipe".daily_update()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
DECLARE
    t record;
    o record;
BEGIN
    FOR t IN
        SELECT th.id, th.step FROM "sales-pipe".threads th
        JOIN "sales-pipe".opportunities op ON op.id = th.opportunity_id
        JOIN "sales-pipe".businesses b ON b.id = op.business_id
        WHERE th.next_due_on <= CURRENT_DATE AND th.step < 4
          AND th.status IN ('Not contacted', 'Awaiting reply')
          AND op.stage IN ('Active', 'Interested')
          AND NOT b.archived AND b.off_target_at IS NULL
    LOOP
        PERFORM "sales-pipe".generate_draft(t.id,
            CASE t.step WHEN 0 THEN 'First contact' WHEN 1 THEN 'Follow-up 1' WHEN 2 THEN 'Follow-up 2' ELSE 'Final check' END);
    END LOOP;

    -- Final check sent, no reply after 14 working days
    UPDATE "sales-pipe".threads
    SET status = 'No reply', next_due_on = NULL
    WHERE step = 4 AND status = 'Awaiting reply'
      AND "sales-pipe".add_working_days(last_outbound_at::date, 14) <= CURRENT_DATE;

    UPDATE "sales-pipe".opportunities op
    SET stage = 'No response', closed_at = now()
    WHERE op.stage = 'Active'
      AND EXISTS (SELECT 1 FROM "sales-pipe".threads th WHERE th.opportunity_id = op.id AND th.step > 0)
      AND NOT EXISTS (SELECT 1 FROM "sales-pipe".threads th WHERE th.opportunity_id = op.id AND th.step > 0 AND th.status <> 'No reply')
      AND NOT EXISTS (SELECT 1 FROM "sales-pipe".threads th WHERE th.opportunity_id = op.id AND th.last_inbound_at IS NOT NULL);

    UPDATE "sales-pipe".opportunities op
    SET stage = 'Went cold'
    WHERE op.stage IN ('Active', 'Interested')
      AND EXISTS (
          SELECT 1 FROM "sales-pipe".threads th
          WHERE th.opportunity_id = op.id AND th.last_inbound_at IS NOT NULL
            AND th.last_outbound_at > th.last_inbound_at
            AND "sales-pipe".add_working_days(th.last_outbound_at::date, 5) <= CURRENT_DATE
            AND (SELECT count(*) FROM "sales-pipe".messages m
                 WHERE m.thread_id = th.id AND m.direction = 'outbound' AND m.created_at > th.last_inbound_at) >= 2);

    FOR o IN
        SELECT op.id, op.assigned_sales_id, b.business_name
        FROM "sales-pipe".opportunities op JOIN "sales-pipe".businesses b ON b.id = op.business_id
        WHERE op.stage = 'Won' AND op.upsell_reminder_on <= CURRENT_DATE
    LOOP
        IF o.assigned_sales_id IS NOT NULL THEN
            INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
            VALUES (o.assigned_sales_id, 'upsell_due', 'Upsell due for ' || o.business_name, '/dashboard/' || o.id);
        END IF;
        UPDATE "sales-pipe".opportunities SET upsell_reminder_on = NULL WHERE id = o.id;
    END LOOP;
END;
$fn$;

CREATE OR REPLACE FUNCTION "sales-pipe".enqueue_campaign(p_channel text, p_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
DECLARE
    v_status text;
    v_recipients jsonb;
    v_total int;
    v_queued int;
    v_skipped int;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales', 'consultant']);

    IF p_channel = 'email' THEN
        SELECT status, recipients INTO v_status, v_recipients
        FROM "sales-pipe".email_campaigns WHERE id = p_campaign_id FOR UPDATE;
    ELSIF p_channel = 'whatsapp' THEN
        SELECT status, recipients INTO v_status, v_recipients
        FROM "sales-pipe".whatsapp_campaigns WHERE id = p_campaign_id FOR UPDATE;
    ELSE
        RAISE EXCEPTION 'Unknown campaign channel: %', p_channel;
    END IF;

    IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found.'; END IF;
    IF v_status IN ('sending', 'sent') THEN RAISE EXCEPTION 'This campaign has already been launched.'; END IF;

    -- The app saves recipients with JSON.stringify, so the column can hold a JSON string of an array
    IF jsonb_typeof(v_recipients) = 'string' THEN
        v_recipients := (v_recipients #>> '{}')::jsonb;
    END IF;
    IF v_recipients IS NULL OR jsonb_typeof(v_recipients) <> 'array' THEN
        v_recipients := '[]'::jsonb;
    END IF;
    v_total := jsonb_array_length(v_recipients);

    IF p_channel = 'email' THEN
        WITH src AS (
            SELECT DISTINCT ON (lower(trim(r->>'email')))
                lower(trim(r->>'email')) AS email,
                nullif(trim(r->>'business_name'), '') AS business_name,
                nullif(trim(r->>'contact_name'), '') AS contact_name,
                CASE WHEN r->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                     THEN (r->>'id')::uuid END AS rid
            FROM jsonb_array_elements(v_recipients) r
            WHERE coalesce(trim(r->>'email'), '') ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
        ), ins AS (
            INSERT INTO "sales-pipe".campaign_recipients
                (channel, campaign_id, email, business_name, contact_name, business_id, status, error_detail)
            SELECT 'email', p_campaign_id, s.email, s.business_name, s.contact_name,
                   (SELECT b.id FROM "sales-pipe".businesses b WHERE b.id = s.rid),
                   CASE WHEN o.id IS NULL AND ot.id IS NULL THEN 'queued' ELSE 'skipped' END,
                   CASE WHEN o.id IS NOT NULL THEN 'Opted out' WHEN ot.id IS NOT NULL THEN 'Off-target lead' END
            FROM src s
            LEFT JOIN LATERAL (
                SELECT id FROM "sales-pipe".opt_outs
                WHERE lower(identifier) = s.email AND lower(channel) IN ('all', 'email') LIMIT 1
            ) o ON true
            -- Leads marked off-target are never sent to
            LEFT JOIN "sales-pipe".businesses ot ON ot.id = s.rid AND ot.off_target_at IS NOT NULL
            RETURNING status
        )
        SELECT count(*) FILTER (WHERE status = 'queued'), count(*) FILTER (WHERE status = 'skipped')
        INTO v_queued, v_skipped FROM ins;
    ELSE
        WITH src AS (
            SELECT DISTINCT ON (regexp_replace(r->>'whatsapp_number', '\D', '', 'g'))
                trim(r->>'whatsapp_number') AS phone,
                regexp_replace(r->>'whatsapp_number', '\D', '', 'g') AS digits,
                nullif(trim(r->>'business_name'), '') AS business_name,
                nullif(trim(r->>'contact_name'), '') AS contact_name,
                CASE WHEN r->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                     THEN (r->>'id')::uuid END AS rid
            FROM jsonb_array_elements(v_recipients) r
            WHERE length(regexp_replace(coalesce(r->>'whatsapp_number', ''), '\D', '', 'g')) >= 7
        ), ins AS (
            INSERT INTO "sales-pipe".campaign_recipients
                (channel, whatsapp_campaign_id, phone, business_name, contact_name, business_id, status, error_detail)
            SELECT 'whatsapp', p_campaign_id, s.phone, s.business_name, s.contact_name,
                   (SELECT b.id FROM "sales-pipe".businesses b WHERE b.id = s.rid),
                   CASE WHEN o.id IS NULL AND ot.id IS NULL THEN 'queued' ELSE 'skipped' END,
                   CASE WHEN o.id IS NOT NULL THEN 'Opted out' WHEN ot.id IS NOT NULL THEN 'Off-target lead' END
            FROM src s
            LEFT JOIN LATERAL (
                SELECT id FROM "sales-pipe".opt_outs
                WHERE regexp_replace(identifier, '\D', '', 'g') = s.digits AND lower(channel) IN ('all', 'whatsapp') LIMIT 1
            ) o ON true
            -- Leads marked off-target are never sent to
            LEFT JOIN "sales-pipe".businesses ot ON ot.id = s.rid AND ot.off_target_at IS NOT NULL
            RETURNING status
        )
        SELECT count(*) FILTER (WHERE status = 'queued'), count(*) FILTER (WHERE status = 'skipped')
        INTO v_queued, v_skipped FROM ins;
    END IF;

    IF v_queued = 0 THEN
        RAISE EXCEPTION '%', CASE WHEN v_skipped > 0
            THEN 'Every recipient in this list has opted out or is off-target.'
            ELSE 'No valid recipients in this campaign.' END;
    END IF;

    IF p_channel = 'email' THEN
        UPDATE "sales-pipe".email_campaigns
        SET status = 'sending', recipient_count = v_queued, sent_at = NULL, updated_at = now()
        WHERE id = p_campaign_id;
    ELSE
        UPDATE "sales-pipe".whatsapp_campaigns
        SET status = 'sending', recipient_count = v_queued, sent_at = NULL, updated_at = now()
        WHERE id = p_campaign_id;
    END IF;

    RETURN jsonb_build_object(
        'queued', v_queued,
        'skipped', v_skipped,               -- opted out or off-target
        'removed', v_total - v_queued - v_skipped  -- invalid address or duplicate
    );
END;
$fn$;

REVOKE ALL ON FUNCTION "sales-pipe".can_mark_leads(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "sales-pipe".can_mark_leads(uuid[]) TO authenticated, service_role;
REVOKE ALL ON FUNCTION "sales-pipe".mark_off_target(uuid[], text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "sales-pipe".mark_off_target(uuid[], text, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION "sales-pipe".clear_off_target(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "sales-pipe".clear_off_target(uuid[]) TO authenticated, service_role;
REVOKE ALL ON FUNCTION "sales-pipe".list_off_target_leads() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "sales-pipe".list_off_target_leads() TO authenticated, service_role;
REVOKE ALL ON FUNCTION "sales-pipe".v_dashboard_status_counts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "sales-pipe".v_dashboard_status_counts(uuid) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
