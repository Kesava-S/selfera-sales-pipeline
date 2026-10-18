-- ==============================================================================
-- 33_dashboard_drilldown.sql
-- Functions for Dashboard drill-down:
-- 1. canonical_business_type: maps any variant into 4 canonical business types
-- 2. status_type_counts: returns (business_type, count) for 4 types by pipeline status
-- 3. reply_platform_counts: returns (platform, count) for Needs reply by type
-- 4. status_list: paged list with specific row fields for each pipeline status + total_count
-- ==============================================================================

SET search_path TO "sales-pipe", public;

-- ------------------------------------------------------------------------------
-- 1. Canonical business type resolver
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".canonical_business_type(p_type text)
RETURNS text AS $$
DECLARE
    clean text := lower(trim(coalesce(p_type, '')));
BEGIN
    IF clean IN ('hotel', 'hotels', 'boutique hotel', 'b&b / guesthouse', 'b&b', 'guesthouse', 'hostel') THEN
        RETURN 'Hotel';
    ELSIF clean IN ('restaurant or cafe', 'restaurant', 'cafe', 'cafes', 'bakery', 'takeaway', 'restaurants and cafes', 'restaurants and cafes', 'restaurants & cafes', 'food & drink') THEN
        RETURN 'Restaurant or cafe';
    ELSIF clean IN ('pub', 'pubs', 'pub / bar', 'bar', 'bars', 'public house') THEN
        RETURN 'Pub';
    ELSIF clean IN ('property management', 'property', 'short-let / airbnb host', 'short-let', 'airbnb', 'serviced apartments') THEN
        RETURN 'Property management';
    ELSE
        IF clean LIKE '%hotel%' OR clean LIKE '%guesthouse%' THEN RETURN 'Hotel';
        ELSIF clean LIKE '%pub%' OR clean LIKE '%bar%' THEN RETURN 'Pub';
        ELSIF clean LIKE '%property%' OR clean LIKE '%short-let%' OR clean LIKE '%apartment%' THEN RETURN 'Property management';
        ELSE RETURN 'Restaurant or cafe';
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ------------------------------------------------------------------------------
-- 2. status_type_counts(p_status text)
-- Returns counts for all 4 business types for a given status.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".status_type_counts(p_status text)
RETURNS TABLE (business_type text, count bigint) AS $$
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
        WHERE NOT b.archived
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

REVOKE ALL ON FUNCTION "sales-pipe".status_type_counts(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION "sales-pipe".status_type_counts(text) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe".status_type_counts(text) TO service_role;

-- ------------------------------------------------------------------------------
-- 3. reply_platform_counts(p_type text)
-- Returns counts for each outreach platform for "Needs reply" filtered by business type.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".reply_platform_counts(p_type text DEFAULT NULL)
RETURNS TABLE (platform text, count bigint) AS $$
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
        WHERE NOT b.archived
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

REVOKE ALL ON FUNCTION "sales-pipe".reply_platform_counts(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION "sales-pipe".reply_platform_counts(text) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe".reply_platform_counts(text) TO service_role;

-- ------------------------------------------------------------------------------
-- 4. status_list(p_status text, p_type text, p_platform text, p_limit int, p_offset int)
-- Paged list for drilldown views with stage-specific row fields.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".status_list(
    p_status text,
    p_type text DEFAULT NULL,
    p_platform text DEFAULT NULL,
    p_limit int DEFAULT 25,
    p_offset int DEFAULT 0
)
RETURNS TABLE (
    opportunity_id uuid,
    business_id uuid,
    business_name text,
    business_type text,
    thread_id uuid,
    platform text,
    latest_message text,
    last_inbound_at timestamptz,
    consultation_at timestamptz,
    consultant_id uuid,
    consultant_name text,
    last_contact_at timestamptz,
    platforms_tried text[],
    total_count bigint
) AS $$
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
            WHERE NOT b.archived
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
            WHERE NOT b.archived
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
            WHERE NOT b.archived
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
            WHERE NOT b.archived
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
            WHERE NOT b.archived
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
            WHERE NOT b.archived
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
        WHERE NOT b.archived
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

REVOKE ALL ON FUNCTION "sales-pipe".status_list(text, text, text, int, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION "sales-pipe".status_list(text, text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe".status_list(text, text, text, int, int) TO service_role;
