-- ==============================================================================
-- 34_business_types_fix.sql
-- One set of business types everywhere: Hotel, Restaurant or cafe, Pub,
-- Property management.
-- 1. Converts stored types to the 4 names (known old names only, no guessing).
--    If any business has a type that cannot be converted, the file stops and
--    lists those types, so you can decide. Nothing is changed in that case.
-- 2. The database accepts only the 4 types from now on.
-- 3. Drops the guessing in canonical_business_type and type_category.
-- 4. Dashboard lists: stable paging order, nothing for an unknown status,
--    reply boxes only for platforms that receive replies.
-- 5. Fixes found in 28 and 32: import called a missing add_pitch function,
--    and the email tables were open to anyone with the public (anon) key.
-- Safe to re-run. Run after 33.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

-- 1. Convert stored types
CREATE OR REPLACE FUNCTION "sales-pipe".old_type_to_new(p_type text)
RETURNS text AS $$
    SELECT CASE lower(trim(coalesce(p_type, '')))
        WHEN 'hotel' THEN 'Hotel' WHEN 'hotels' THEN 'Hotel' WHEN 'boutique hotel' THEN 'Hotel'
        WHEN 'b&b / guesthouse' THEN 'Hotel' WHEN 'b&b' THEN 'Hotel' WHEN 'guesthouse' THEN 'Hotel' WHEN 'hostel' THEN 'Hotel'
        WHEN 'restaurant or cafe' THEN 'Restaurant or cafe' WHEN 'restaurants and cafes' THEN 'Restaurant or cafe'
        WHEN 'restaurants & cafes' THEN 'Restaurant or cafe' WHEN 'restaurant' THEN 'Restaurant or cafe'
        WHEN 'cafe' THEN 'Restaurant or cafe' WHEN 'bakery' THEN 'Restaurant or cafe' WHEN 'takeaway' THEN 'Restaurant or cafe'
        WHEN 'pub' THEN 'Pub' WHEN 'pubs' THEN 'Pub' WHEN 'pub / bar' THEN 'Pub' WHEN 'bar' THEN 'Pub' WHEN 'public house' THEN 'Pub'
        WHEN 'property management' THEN 'Property management' WHEN 'short-let / airbnb host' THEN 'Property management'
        WHEN 'serviced apartments' THEN 'Property management'
        ELSE NULL END
$$ LANGUAGE sql IMMUTABLE;

DO $$
DECLARE
    v_bad text;
BEGIN
    SELECT string_agg(DISTINCT business_type || ' (' || n || ')', ', ') INTO v_bad
    FROM (SELECT business_type, count(*) OVER (PARTITION BY business_type) AS n
          FROM "sales-pipe".businesses
          WHERE "sales-pipe".old_type_to_new(business_type) IS NULL) x;
    IF v_bad IS NOT NULL THEN
        RAISE EXCEPTION 'These business types cannot be converted to the 4 new types: %. Change the type of those businesses first (Lead Management > Edit details), then run this file again.', v_bad;
    END IF;

    UPDATE "sales-pipe".businesses
    SET business_type = "sales-pipe".old_type_to_new(business_type)
    WHERE business_type IS DISTINCT FROM "sales-pipe".old_type_to_new(business_type);
END $$;

-- 2. Only the 4 types from now on
ALTER TABLE "sales-pipe".businesses DROP CONSTRAINT IF EXISTS businesses_type_check;
ALTER TABLE "sales-pipe".businesses ADD CONSTRAINT businesses_type_check
    CHECK (business_type IN ('Hotel', 'Restaurant or cafe', 'Pub', 'Property management'));

-- 3. No guessing: exact names only (anything else = NULL, which import reports as "Unknown category")
CREATE OR REPLACE FUNCTION "sales-pipe".type_category(p_type text)
RETURNS text AS $$
    SELECT CASE p_type
        WHEN 'Hotel' THEN 'Accommodation'
        WHEN 'Property management' THEN 'Accommodation'
        WHEN 'Restaurant or cafe' THEN 'Food & Drink'
        WHEN 'Pub' THEN 'Food & Drink'
        ELSE NULL END
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION "sales-pipe".canonical_business_type(p_type text)
RETURNS text AS $$
    SELECT CASE WHEN p_type IN ('Hotel', 'Restaurant or cafe', 'Pub', 'Property management') THEN p_type ELSE NULL END
$$ LANGUAGE sql IMMUTABLE;

UPDATE "sales-pipe".businesses SET category = "sales-pipe".type_category(business_type)
WHERE category IS DISTINCT FROM "sales-pipe".type_category(business_type);

-- 4a. Reply boxes: only platforms that receive replies
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
        SELECT unnest(ARRAY['WhatsApp', 'Instagram', 'Facebook', 'Email']) AS p_name
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
          AND (nullif(p_type, '') IS NULL OR b.business_type = p_type)
    )
    SELECT p.p_name AS platform, count(m.platform)::bigint AS count
    FROM platforms p
    LEFT JOIN matching_threads m ON m.platform = p.p_name
    GROUP BY p.p_name
    ORDER BY array_position(ARRAY['WhatsApp', 'Instagram', 'Facebook', 'Email'], p.p_name);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

-- 4b. Lists: sorted before paging, nothing for an unknown status
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
        )
        SELECT
            r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type,
            r.r_thread_id, r.r_platform, r.r_latest_message, r.r_last_inbound_at,
            r.r_consultation_at, r.r_consultant_id, r.r_consultant_name,
            r.r_last_contact_at, r.r_platforms_tried,
            count(*) OVER () AS total_count
        FROM rows r
        ORDER BY r.r_last_inbound_at ASC, r.r_thread_id
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
        )
        SELECT
            r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type,
            r.r_thread_id, r.r_platform, r.r_latest_message, r.r_last_inbound_at,
            r.r_consultation_at, r.r_consultant_id, r.r_consultant_name,
            r.r_last_contact_at, r.r_platforms_tried,
            count(*) OVER () AS total_count
        FROM rows r
        ORDER BY r.r_last_inbound_at DESC NULLS LAST, r.r_opportunity_id
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
        )
        SELECT
            r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type,
            r.r_thread_id, r.r_platform, r.r_latest_message, r.r_last_inbound_at,
            r.r_consultation_at, r.r_consultant_id, r.r_consultant_name,
            r.r_last_contact_at, r.r_platforms_tried,
            count(*) OVER () AS total_count
        FROM rows r
        ORDER BY r.r_consultation_at ASC NULLS LAST, r.r_opportunity_id
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
        )
        SELECT
            r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type,
            r.r_thread_id, r.r_platform, r.r_latest_message, r.r_last_inbound_at,
            r.r_consultation_at, r.r_consultant_id, r.r_consultant_name,
            r.r_last_contact_at, r.r_platforms_tried,
            count(*) OVER () AS total_count
        FROM rows r
        ORDER BY r.r_consultation_at ASC NULLS LAST, r.r_opportunity_id
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
        )
        SELECT
            r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type,
            r.r_thread_id, r.r_platform, r.r_latest_message, r.r_last_inbound_at,
            r.r_consultation_at, r.r_consultant_id, r.r_consultant_name,
            r.r_last_contact_at, r.r_platforms_tried,
            count(*) OVER () AS total_count
        FROM rows r
        ORDER BY r.r_last_contact_at DESC NULLS LAST, r.r_opportunity_id
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
        )
        SELECT
            r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type,
            r.r_thread_id, r.r_platform, r.r_latest_message, r.r_last_inbound_at,
            r.r_consultation_at, r.r_consultant_id, r.r_consultant_name,
            r.r_last_contact_at, r.r_platforms_tried,
            count(*) OVER () AS total_count
        FROM rows r
        ORDER BY r.r_business_name, r.r_opportunity_id
        LIMIT least(coalesce(p_limit, 25), 100) OFFSET greatest(coalesce(p_offset, 0), 0);
        RETURN;
    END IF;

    -- Unknown status: nothing
    RETURN;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;


-- 5a. import_businesses (file 32) calls add_pitch: create it if missing.
--     New pitch waits in the review queue, like file 23 did.
DO $$
BEGIN
    IF to_regprocedure('"sales-pipe".add_pitch(uuid, text[], text)') IS NULL THEN
        EXECUTE $f$
            CREATE FUNCTION "sales-pipe".add_pitch(p_business_id uuid, p_services text[], p_demo_link text DEFAULT NULL)
            RETURNS uuid AS $b$
            DECLARE v_id uuid;
            BEGIN
                INSERT INTO "sales-pipe".opportunities (business_id, services_pitched, stage, demo_link)
                VALUES (p_business_id, p_services, 'Needs review', p_demo_link)
                RETURNING id INTO v_id;
                RETURN v_id;
            END;
            $b$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public
        $f$;
    END IF;
END $$;
REVOKE ALL ON FUNCTION "sales-pipe".add_pitch(uuid, text[], text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe".add_pitch(uuid, text[], text) TO service_role;

-- 5b. Close the public (anon) key: staff with an active account only
REVOKE ALL ON "sales-pipe".email_databases, "sales-pipe".email_campaigns FROM anon;
DROP POLICY IF EXISTS "email_databases_access" ON "sales-pipe".email_databases;
CREATE POLICY "email_databases_access" ON "sales-pipe".email_databases
    FOR ALL TO authenticated USING ("sales-pipe".get_user_role() IS NOT NULL) WITH CHECK ("sales-pipe".get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "email_campaigns_access" ON "sales-pipe".email_campaigns;
CREATE POLICY "email_campaigns_access" ON "sales-pipe".email_campaigns
    FOR ALL TO authenticated USING ("sales-pipe".get_user_role() IS NOT NULL) WITH CHECK ("sales-pipe".get_user_role() IS NOT NULL);
REVOKE EXECUTE ON FUNCTION "sales-pipe".import_businesses(jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION "sales-pipe".list_pitches(text, text, text, text, text, text, boolean, int, int) FROM anon, public;

REVOKE ALL ON FUNCTION "sales-pipe".reply_platform_counts(text) FROM public, anon;
REVOKE ALL ON FUNCTION "sales-pipe".status_list(text, text, text, int, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION "sales-pipe".reply_platform_counts(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe".status_list(text, text, text, int, int) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
