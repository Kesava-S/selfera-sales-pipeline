-- 68_consultant_access_and_permissions.sql
-- Ensure consultants have proper access to unassigned leads and consultation stage leads,
-- preventing null business data, broken status views, and missing RLS read permissions.

-- 1. can_see_business: allow consultants for unassigned opportunities and consultation stage
CREATE OR REPLACE FUNCTION "sales-pipe".can_see_business(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
    SELECT "sales-pipe".get_user_role() = 'admin'
        OR EXISTS (
            SELECT 1 FROM "sales-pipe".opportunities o
            WHERE o.business_id = p_business_id
              AND (
                  o.assigned_sales_id = auth.uid()
                  OR o.assigned_consultant_id = auth.uid()
                  OR ("sales-pipe".get_user_role() IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
                  OR ("sales-pipe".get_user_role() = 'consultant' AND o.stage = 'Consultation')
              )
        );
$function$;

-- 2. can_mark_leads: allow consultants for their assigned leads, unassigned leads, and consultations
CREATE OR REPLACE FUNCTION "sales-pipe".can_mark_leads(p_business_ids uuid[])
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
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
              AND (
                  o.assigned_sales_id = v_uid
                  OR o.assigned_consultant_id = v_uid
                  OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
                  OR (v_role = 'consultant' AND o.stage = 'Consultation')
              )
        )
    );
END;
$function$;

-- 3. check_opp_access: allow consultants access to consultation stage
CREATE OR REPLACE FUNCTION "sales-pipe".check_opp_access(p_opportunity_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_opp record;
    v_role text;
BEGIN
    IF auth.role() = 'service_role' THEN RETURN; END IF;
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not logged in'; END IF;
    v_role := "sales-pipe".get_user_role();
    IF v_role IS NULL THEN RAISE EXCEPTION 'Your account is not set up'; END IF;
    IF v_role = 'admin' THEN RETURN; END IF;

    SELECT * INTO v_opp FROM "sales-pipe".opportunities WHERE id = p_opportunity_id;
    IF v_opp.id IS NULL THEN RAISE EXCEPTION 'Pitch not found'; END IF;

    IF auth.uid() = v_opp.assigned_consultant_id THEN RETURN; END IF;

    IF auth.uid() = v_opp.assigned_sales_id THEN
        IF v_opp.assigned_consultant_id IS NOT NULL AND v_opp.stage = 'Consultation' THEN
            RAISE EXCEPTION 'This business has been handed over to a consultant';
        END IF;
        RETURN;
    END IF;

    IF v_role IN ('sales', 'consultant') AND v_opp.assigned_sales_id IS NULL AND v_opp.assigned_consultant_id IS NULL THEN
        RETURN; -- unassigned (review queue)
    END IF;

    IF v_role = 'consultant' AND v_opp.stage = 'Consultation' THEN
        RETURN; -- consultant access to consultation stage
    END IF;

    RAISE EXCEPTION 'You are not assigned to this business';
END;
$function$;

-- 4. list_off_target_leads: allow consultants to see unassigned & consultation leads marked off-target
CREATE OR REPLACE FUNCTION "sales-pipe".list_off_target_leads()
RETURNS TABLE(business_id uuid, business_name text, business_type text, area text, opportunity_id uuid, stage text, reason text, noticed text, note text, marked_at timestamp with time zone, marked_by_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
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
               OR (v_role IN ('sales', 'consultant') AND o2.assigned_sales_id IS NULL AND o2.assigned_consultant_id IS NULL)
               OR (v_role = 'consultant' AND o2.stage = 'Consultation'))
        ORDER BY o2.created_at DESC LIMIT 1
    ) o ON true
    LEFT JOIN "sales-pipe".profiles p ON p.id = b.off_target_by
    WHERE b.off_target_at IS NOT NULL AND NOT b.archived
    ORDER BY b.off_target_at DESC
    LIMIT 1000;
END;
$function$;

-- 5. reply_platform_counts: allow consultants to count platforms for unassigned & consultation leads
CREATE OR REPLACE FUNCTION "sales-pipe".reply_platform_counts(p_type text DEFAULT NULL::text)
RETURNS TABLE(platform text, count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
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
               OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
               OR (v_role = 'consultant' AND o.stage = 'Consultation'))
          AND (nullif(p_type, '') IS NULL OR "sales-pipe".canonical_business_type(b.business_type) = "sales-pipe".canonical_business_type(p_type))
    )
    SELECT p.p_name AS platform, count(m.platform)::bigint AS count
    FROM platforms p
    LEFT JOIN matching_threads m ON m.platform = p.p_name
    GROUP BY p.p_name
    ORDER BY array_position(ARRAY['WhatsApp', 'Instagram', 'Facebook', 'Email', 'LinkedIn'], p.p_name);
END;
$function$;

-- 6. status_type_counts: allow consultants to see type breakdown
CREATE OR REPLACE FUNCTION "sales-pipe".status_type_counts(p_status text)
RETURNS TABLE(business_type text, count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
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
               OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
               OR (v_role = 'consultant' AND o.stage = 'Consultation'))
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
$function$;

-- 7. status_list: allow consultants across all status views
CREATE OR REPLACE FUNCTION "sales-pipe".status_list(p_status text, p_type text DEFAULT NULL::text, p_platform text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
RETURNS TABLE(opportunity_id uuid, business_id uuid, business_name text, business_type text, thread_id uuid, platform text, latest_message text, last_inbound_at timestamp with time zone, consultation_at timestamp with time zone, consultant_id uuid, consultant_name text, last_contact_at timestamp with time zone, platforms_tried text[], total_count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
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
                   OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
                   OR (v_role = 'consultant' AND o.stage = 'Consultation'))
              AND (nullif(p_type, '') IS NULL OR "sales-pipe".canonical_business_type(b.business_type) = "sales-pipe".canonical_business_type(p_type))
              AND (nullif(p_platform, '') IS NULL OR t.platform = p_platform)
            ORDER BY t.last_inbound_at DESC NULLS LAST, o.created_at DESC
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
            FROM "sales-pipe".opportunities o
            JOIN "sales-pipe".businesses b ON b.id = o.business_id
            LEFT JOIN LATERAL (
                SELECT t2.id, t2.platform, t2.last_inbound_at
                FROM "sales-pipe".threads t2
                WHERE t2.opportunity_id = o.id AND t2.status = 'Replied'
                ORDER BY t2.last_inbound_at DESC NULLS LAST LIMIT 1
            ) t ON true
            WHERE NOT b.archived AND b.off_target_at IS NULL
              AND o.stage = 'Interested'
              AND (v_role = 'admin' OR auth.role() = 'service_role'
                   OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
                   OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
              AND (nullif(p_type, '') IS NULL OR "sales-pipe".canonical_business_type(b.business_type) = "sales-pipe".canonical_business_type(p_type))
            ORDER BY coalesce(t.last_inbound_at, o.created_at) DESC
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
                   OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
                   OR (v_role = 'consultant' AND o.stage = 'Consultation'))
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
                o.consultation_at AS r_consultation_at,
                o.assigned_consultant_id AS r_consultant_id,
                NULL::text AS r_consultant_name,
                NULL::timestamptz AS r_last_contact_at,
                NULL::text[] AS r_platforms_tried
            FROM "sales-pipe".opportunities o
            JOIN "sales-pipe".businesses b ON b.id = o.business_id
            WHERE NOT b.archived AND b.off_target_at IS NULL
              AND o.stage = 'Consultation' AND o.assigned_consultant_id IS NULL
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
                (SELECT max(coalesce(t.last_outbound_at, t.last_inbound_at))
                 FROM "sales-pipe".threads t
                 WHERE t.opportunity_id = o.id) AS r_last_contact_at,
                NULL::text[] AS r_platforms_tried
            FROM "sales-pipe".opportunities o
            JOIN "sales-pipe".businesses b ON b.id = o.business_id
            WHERE NOT b.archived AND b.off_target_at IS NULL
              AND o.stage = 'Went cold'
              AND (v_role = 'admin' OR auth.role() = 'service_role'
                   OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
                   OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
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
                (SELECT max(t.last_outbound_at)
                 FROM "sales-pipe".threads t
                 WHERE t.opportunity_id = o.id) AS r_last_contact_at,
                coalesce(
                    (SELECT array_agg(DISTINCT t.platform)
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
                   OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
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
               OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
               OR (v_role = 'consultant' AND o.stage = 'Consultation'))
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
$function$;

-- 8. v_dashboard_status_counts: count visible leads for consultants
CREATE OR REPLACE FUNCTION "sales-pipe".v_dashboard_status_counts(p_user uuid)
RETURNS TABLE(needs_reply bigint, interested bigint, consultation bigint, went_cold bigint, no_response bigint, needs_consultant bigint, off_target bigint, needs_review bigint, total_pitches bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
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
           OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
           OR (v_role = 'consultant' AND o.stage = 'Consultation')
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
$function$;

-- 9. v_business_type_counts: allow consultants to count business types
CREATE OR REPLACE FUNCTION "sales-pipe".v_business_type_counts(p_service text, p_user uuid)
RETURNS TABLE(business_type text, businesses_count bigint, replies_count bigint, due_today_count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_role text;
BEGIN
    IF auth.role() <> 'service_role' AND p_user IS DISTINCT FROM auth.uid()
       AND coalesce("sales-pipe".get_user_role(), '') <> 'admin' THEN
        RAISE EXCEPTION 'You can only see your own numbers';
    END IF;
    SELECT role INTO v_role FROM "sales-pipe".profiles WHERE id = p_user;

    RETURN QUERY
    SELECT b.business_type,
        count(DISTINCT b.id),
        count(DISTINCT o.id) FILTER (WHERE o.stage IN ('Active', 'Interested', 'Consultation') AND EXISTS (
            SELECT 1 FROM "sales-pipe".threads t WHERE t.opportunity_id = o.id AND t.status = 'Replied'
              AND t.last_inbound_at > coalesce(t.last_outbound_at, '-infinity'))),
        count(DISTINCT o.id) FILTER (WHERE o.stage IN ('Active', 'Interested') AND EXISTS (
            SELECT 1 FROM "sales-pipe".threads t WHERE t.opportunity_id = o.id
              AND t.status IN ('Not contacted', 'Awaiting reply') AND t.next_due_on <= CURRENT_DATE))
    FROM "sales-pipe".opportunities o
    JOIN "sales-pipe".businesses b ON b.id = o.business_id AND NOT b.archived
    WHERE p_service = ANY(o.services_pitched)
      AND (v_role = 'admin' OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user
           OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
           OR (v_role = 'consultant' AND o.stage = 'Consultation'))
    GROUP BY b.business_type
    ORDER BY count(DISTINCT b.id) DESC;
END;
$function$;

-- 10. update_lead_field: allow consultants to edit fields on consultation stage leads
CREATE OR REPLACE FUNCTION "sales-pipe".update_lead_field(p_business_id uuid, p_field text, p_value text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
    v_field text := lower(trim(p_field));
    v_val text := trim(coalesce(p_value, ''));
    v_clean_val text := nullif(v_val, '');
    v_services text[];
    v_new_problems text[];
    v_tp_type text;
    v_tp_name text;
BEGIN
    IF v_role IS NULL AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Your account is not set up';
    END IF;

    -- Access check
    IF NOT EXISTS (
        SELECT 1 FROM "sales-pipe".opportunities o
        WHERE o.business_id = p_business_id
          AND (v_role = 'admin' OR auth.role() = 'service_role'
               OR o.assigned_sales_id = v_uid
               OR o.assigned_consultant_id = v_uid
               OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
               OR (v_role = 'consultant' AND o.stage = 'Consultation'))
    ) THEN
        RAISE EXCEPTION 'You cannot edit this business';
    END IF;

    -- Whitelisted fields
    IF v_field IN ('business_name', 'name') THEN
        UPDATE "sales-pipe".businesses SET business_name = coalesce(v_clean_val, '') WHERE id = p_business_id;
    ELSIF v_field IN ('business_type', 'category') THEN
        IF v_clean_val NOT IN ('Hotel', 'Restaurant or cafe', 'Pub', 'Property management') THEN
            RAISE EXCEPTION 'Category must be Hotel, Restaurant or cafe, Pub, or Property management';
        END IF;
        UPDATE "sales-pipe".businesses
        SET business_type = v_clean_val,
            category = "sales-pipe".type_category(v_clean_val)
        WHERE id = p_business_id;
    ELSIF v_field = 'existing_website' OR v_field = 'website' THEN
        UPDATE "sales-pipe".businesses
        SET existing_website = v_clean_val,
            has_no_website = false
        WHERE id = p_business_id;
    ELSIF v_field = 'has_no_website' THEN
        UPDATE "sales-pipe".businesses
        SET has_no_website = coalesce(v_val::boolean, false),
            existing_website = CASE WHEN coalesce(v_val::boolean, false) THEN NULL ELSE existing_website END
        WHERE id = p_business_id;
    ELSIF v_field = 'address' THEN
        UPDATE "sales-pipe".businesses SET address = v_clean_val WHERE id = p_business_id;
    ELSIF v_field = 'postcode' THEN
        UPDATE "sales-pipe".businesses SET postcode = upper(v_clean_val) WHERE id = p_business_id;
    ELSIF v_field IN ('services', 'services_pitched') THEN
        v_services := ARRAY(
            SELECT trim(s) FROM unnest(string_to_array(v_val, ',')) s
            WHERE trim(s) <> '' AND trim(s) = ANY("sales-pipe".valid_services())
        );
        UPDATE "sales-pipe".opportunities
        SET services_pitched = v_services
        WHERE business_id = p_business_id;
    ELSIF v_field IN ('contact_name', 'owner_name') THEN
        UPDATE "sales-pipe".businesses SET contact_name = v_clean_val WHERE id = p_business_id;
    ELSIF v_field = 'owner_email' THEN
        UPDATE "sales-pipe".businesses SET owner_email = lower(v_clean_val) WHERE id = p_business_id;
    ELSIF v_field = 'owner_contact' THEN
        UPDATE "sales-pipe".businesses
        SET owner_contact = v_clean_val,
            owner_email = CASE WHEN v_clean_val ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' THEN lower(v_clean_val) ELSE owner_email END
        WHERE id = p_business_id;
    ELSIF v_field = 'email' THEN
        UPDATE "sales-pipe".businesses SET email = lower(v_clean_val) WHERE id = p_business_id;
    ELSIF v_field = 'whatsapp_number' THEN
        UPDATE "sales-pipe".businesses SET whatsapp_number = v_clean_val WHERE id = p_business_id;
    ELSIF v_field = 'instagram' THEN
        UPDATE "sales-pipe".businesses SET instagram = "sales-pipe".clean_handle(v_clean_val) WHERE id = p_business_id;
    ELSIF v_field = 'facebook' THEN
        UPDATE "sales-pipe".businesses SET facebook = "sales-pipe".clean_handle(v_clean_val) WHERE id = p_business_id;
    ELSIF v_field = 'linkedin' THEN
        UPDATE "sales-pipe".businesses SET linkedin = v_clean_val WHERE id = p_business_id;
    ELSIF v_field = 'tech_partner_type' THEN
        IF v_clean_val NOT IN ('Agency', 'DIY', 'None') THEN
            RAISE EXCEPTION 'Tech partner type must be Agency, DIY, or None';
        END IF;
        UPDATE "sales-pipe".businesses
        SET tech_partner_type = v_clean_val,
            tech_partner_name = CASE WHEN v_clean_val = 'None' THEN NULL ELSE tech_partner_name END
        WHERE id = p_business_id;
    ELSIF v_field IN ('tech_partner', 'existing_tech_partner') THEN
        IF v_clean_val IS NOT NULL THEN
            IF lower(v_clean_val) = 'none' THEN
                v_tp_type := 'None';
                v_tp_name := NULL;
            ELSIF v_clean_val ~* '^Agency' THEN
                v_tp_type := 'Agency';
                v_tp_name := nullif(btrim(regexp_replace(v_clean_val, '^Agency\s*', '', 'i'), ' ()'), '');
                IF v_tp_name IS NULL THEN v_tp_name := 'Agency'; END IF;
            ELSIF v_clean_val ~* '^DIY' THEN
                v_tp_type := 'DIY';
                v_tp_name := nullif(btrim(regexp_replace(v_clean_val, '^DIY\s*', '', 'i'), ' ()'), '');
                IF v_tp_name IS NULL THEN v_tp_name := 'DIY'; END IF;
            ELSE
                v_tp_type := 'Agency';
                v_tp_name := v_clean_val;
            END IF;
        END IF;
        UPDATE "sales-pipe".businesses
        SET tech_partner_type = coalesce(v_tp_type, tech_partner_type),
            tech_partner_name = CASE WHEN v_tp_type = 'None' THEN NULL ELSE coalesce(v_tp_name, tech_partner_name) END
        WHERE id = p_business_id;
    ELSIF v_field = 'gaps_found' THEN
        UPDATE "sales-pipe".businesses SET gaps_found = v_clean_val WHERE id = p_business_id;
    ELSIF v_field = 'source' THEN
        UPDATE "sales-pipe".businesses SET source = v_clean_val WHERE id = p_business_id;
    ELSE
        RAISE EXCEPTION 'Unsupported field: %', p_field;
    END IF;

    -- Recompute problems
    v_new_problems := "sales-pipe".lead_problems(p_business_id);
    UPDATE "sales-pipe".businesses SET problems = v_new_problems WHERE id = p_business_id;

    RETURN jsonb_build_object(
        'ok', true,
        'business_id', p_business_id,
        'field', v_field,
        'problems', to_jsonb(v_new_problems)
    );
END;
$function$;

-- 11. consultation_bookings: allow consultants to see their matched consultation bookings
DROP POLICY IF EXISTS "Consultation bookings read sales" ON "sales-pipe".consultation_bookings;
CREATE POLICY "Consultation bookings read sales" ON "sales-pipe".consultation_bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "sales-pipe".opportunities o
      WHERE o.id = consultation_bookings.matched_opportunity_id
        AND (o.assigned_sales_id = auth.uid() OR o.assigned_consultant_id = auth.uid())
    )
  );

-- 12. campaign_replies: allow consultants to read campaign replies
DROP POLICY IF EXISTS "campaign_replies_read" ON "sales-pipe".campaign_replies;
CREATE POLICY "campaign_replies_read" ON "sales-pipe".campaign_replies
  FOR SELECT USING (
    "sales-pipe".get_user_role() = ANY (ARRAY['admin'::text, 'sales'::text, 'consultant'::text])
  );

