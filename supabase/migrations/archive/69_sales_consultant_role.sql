-- ==============================================================================
-- 69_sales_consultant_role.sql
-- New team role "Sales + Consultant" (sales_consultant): one person who does
-- both jobs. Everywhere a sales person or a consultant is allowed, they are too:
--   * require_role(...) lets them through when the list has sales or consultant
--   * lead visibility = sales rules + consultant rules
--   * they can be assigned as the sales person and as the consultant
--   * campaigns, imports and Client Audience follow the sales rules
-- Admins invite Sales, Consultant or Sales + Consultant (admins are not invited).
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

ALTER TABLE "sales-pipe".profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE "sales-pipe".profiles ADD CONSTRAINT profiles_role_check
    CHECK (role = ANY (ARRAY['admin', 'sales', 'consultant', 'sales_consultant']));

CREATE OR REPLACE FUNCTION "sales-pipe".require_role(p_roles text[])
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $fn$
DECLARE
    v_role text;
BEGIN
    IF auth.role() = 'service_role' THEN RETURN; END IF;
    v_role := coalesce("sales-pipe".get_user_role(), '');
    IF v_role = ANY (p_roles) THEN RETURN; END IF;
    -- Sales + Consultant may do what a sales person or a consultant may do
    IF v_role = 'sales_consultant' AND ('sales' = ANY (p_roles) OR 'consultant' = ANY (p_roles)) THEN RETURN; END IF;
    RAISE EXCEPTION 'You do not have permission to do this';
END;
$fn$;

-- Policies that name the sales role
ALTER POLICY "customer_leads_access" ON "sales-pipe".customer_leads USING (("sales-pipe".get_user_role() = ANY (ARRAY['admin'::text, 'sales'::text, 'sales_consultant'::text]))) WITH CHECK (("sales-pipe".get_user_role() = ANY (ARRAY['admin'::text, 'sales'::text, 'sales_consultant'::text])));
ALTER POLICY "customer_import_batches_access" ON "sales-pipe".customer_import_batches USING (("sales-pipe".get_user_role() = ANY (ARRAY['admin'::text, 'sales'::text, 'sales_consultant'::text]))) WITH CHECK (("sales-pipe".get_user_role() = ANY (ARRAY['admin'::text, 'sales'::text, 'sales_consultant'::text])));
ALTER POLICY "audience_clients_read" ON "sales-pipe".audience_clients USING (("sales-pipe".get_user_role() = ANY (ARRAY['admin'::text, 'sales'::text, 'sales_consultant'::text])));
ALTER POLICY "campaign_replies_read" ON "sales-pipe".campaign_replies USING (("sales-pipe".get_user_role() = ANY (ARRAY['admin'::text, 'sales'::text, 'sales_consultant'::text, 'consultant'::text])));
ALTER POLICY "email_campaigns_access" ON "sales-pipe".email_campaigns USING ((COALESCE("sales-pipe".get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'sales'::text, 'sales_consultant'::text]))) WITH CHECK ((COALESCE("sales-pipe".get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'sales'::text, 'sales_consultant'::text])));
ALTER POLICY "whatsapp_campaigns_access" ON "sales-pipe".whatsapp_campaigns USING ((COALESCE("sales-pipe".get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'sales'::text, 'sales_consultant'::text]))) WITH CHECK ((COALESCE("sales-pipe".get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'sales'::text, 'sales_consultant'::text])));
ALTER POLICY "email_databases_access" ON "sales-pipe".email_databases USING ((COALESCE("sales-pipe".get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'sales'::text, 'sales_consultant'::text]))) WITH CHECK ((COALESCE("sales-pipe".get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'sales'::text, 'sales_consultant'::text])));
ALTER POLICY "whatsapp_databases_access" ON "sales-pipe".whatsapp_databases USING ((COALESCE("sales-pipe".get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'sales'::text, 'sales_consultant'::text]))) WITH CHECK ((COALESCE("sales-pipe".get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'sales'::text, 'sales_consultant'::text])));

-- Functions: role checks include sales_consultant (bodies otherwise unchanged)

CREATE OR REPLACE FUNCTION "sales-pipe".assign_sales(p_opportunity_ids uuid[], p_sales_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
DECLARE v_count int;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin']);
    IF p_sales_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM "sales-pipe".profiles WHERE id = p_sales_id AND role IN ('sales', 'sales_consultant', 'admin') AND is_active) THEN
        RAISE EXCEPTION 'Pick an active salesperson';
    END IF;
    UPDATE "sales-pipe".opportunities SET assigned_sales_id = p_sales_id WHERE id = ANY(p_opportunity_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF p_sales_id IS NOT NULL AND v_count > 0 AND p_sales_id <> auth.uid() THEN
        INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
        VALUES (p_sales_id, 'assigned_to_you', v_count || ' business(es) assigned to you', '/dashboard/leads');
    END IF;
    RETURN v_count;
END;
$fn$;

CREATE OR REPLACE FUNCTION "sales-pipe".auto_assign_sales(p_opportunity_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
DECLARE
    reps uuid[];
    opp_id uuid;
    rep_idx int := 1;
BEGIN
    IF p_opportunity_ids IS NULL OR array_length(p_opportunity_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    SELECT array_agg(id ORDER BY load ASC) INTO reps
    FROM (
        SELECT p.id, count(o.id) AS load, p.capacity
        FROM "sales-pipe".profiles p
        LEFT JOIN "sales-pipe".opportunities o
            ON o.assigned_sales_id = p.id AND o.stage IN ('Active', 'Interested', 'Consultation')
        WHERE p.role IN ('sales', 'sales_consultant') AND p.is_active = true
        GROUP BY p.id, p.capacity
        HAVING count(o.id) < coalesce(p.capacity, 150)
    ) x;

    IF reps IS NULL THEN
        -- Nobody with capacity: leave unassigned and tell the admins
        INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
        SELECT id, 'assigned_to_you', 'New pitches approved but no salesperson has capacity. Assign them manually.', '/dashboard/leads'
        FROM "sales-pipe".profiles WHERE role = 'admin' AND is_active = true;
        RETURN;
    END IF;

    FOREACH opp_id IN ARRAY p_opportunity_ids LOOP
        UPDATE "sales-pipe".opportunities SET assigned_sales_id = reps[rep_idx] WHERE id = opp_id;
        rep_idx := rep_idx % array_length(reps, 1) + 1;
    END LOOP;

    -- One notification per salesperson
    INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
    SELECT assigned_sales_id, 'assigned_to_you', count(*) || ' new pitch(es) assigned to you', '/dashboard'
    FROM "sales-pipe".opportunities
    WHERE id = ANY(p_opportunity_ids) AND assigned_sales_id IS NOT NULL
    GROUP BY assigned_sales_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION "sales-pipe".bulk_set_field(p_business_ids uuid[], p_field text, p_value text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
    v_field text := lower(trim(p_field));
    v_val text := trim(coalesce(p_value, ''));
    v_services text[];
    v_count int := 0;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales', 'consultant']);

    IF v_field IN ('services', 'service', 'services_pitched') THEN
        SELECT coalesce(array_agg(DISTINCT trim(s)) FILTER (WHERE trim(s) <> ''), '{}')
          INTO v_services
          FROM unnest(string_to_array(replace(v_val, ';', ','), ',')) s;
        SELECT coalesce(array_agg(s), '{}') INTO v_services
          FROM unnest(v_services) s
          WHERE s = ANY("sales-pipe".valid_services());
        IF array_length(v_services, 1) IS NULL THEN
            RAISE EXCEPTION 'Pick at least one valid service';
        END IF;

        UPDATE "sales-pipe".opportunities o
        SET services_pitched = v_services
        WHERE o.business_id = ANY(p_business_ids)
          AND o.stage = 'Needs review'
          AND (v_role = 'admin' OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
               OR (v_role IN ('sales', 'consultant', 'sales_consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL));
        GET DIAGNOSTICS v_count = ROW_COUNT;

    ELSIF v_field IN ('category', 'business_type') THEN
        IF v_val NOT IN ('Hotel', 'Restaurant or cafe', 'Pub', 'Property management') THEN
            v_val := "sales-pipe".canonical_business_type(v_val);
        END IF;
        IF v_val IS NULL THEN RAISE EXCEPTION 'Invalid category'; END IF;

        UPDATE "sales-pipe".businesses b
        SET business_type = v_val, category = "sales-pipe".type_category(v_val)
        WHERE b.id = ANY(p_business_ids)
          AND EXISTS (
              SELECT 1 FROM "sales-pipe".opportunities o
              WHERE o.business_id = b.id
                AND (v_role = 'admin' OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
                     OR (v_role IN ('sales', 'consultant', 'sales_consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
          );
        GET DIAGNOSTICS v_count = ROW_COUNT;

    ELSIF v_field = 'source' THEN
        UPDATE "sales-pipe".businesses b
        SET source = nullif(v_val, '')
        WHERE b.id = ANY(p_business_ids)
          AND EXISTS (
              SELECT 1 FROM "sales-pipe".opportunities o
              WHERE o.business_id = b.id
                AND (v_role = 'admin' OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
                     OR (v_role IN ('sales', 'consultant', 'sales_consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
          );
        GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
        RAISE EXCEPTION 'Bulk set not supported for %', p_field;
    END IF;

    -- Recompute problems
    PERFORM "sales-pipe".lead_problems(b_id) FROM unnest(p_business_ids) AS b_id;

    RETURN v_count;
END;
$fn$;

CREATE OR REPLACE FUNCTION "sales-pipe".can_mark_leads(p_business_ids uuid[])
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
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
                  OR (v_role IN ('sales', 'consultant', 'sales_consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
                  OR (v_role IN ('consultant', 'sales_consultant') AND o.stage = 'Consultation')
              )
        )
    );
END;
$fn$;

CREATE OR REPLACE FUNCTION "sales-pipe".can_see_business(p_business_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
    SELECT "sales-pipe".get_user_role() = 'admin'
        OR EXISTS (
            SELECT 1 FROM "sales-pipe".opportunities o
            WHERE o.business_id = p_business_id
              AND (
                  o.assigned_sales_id = auth.uid()
                  OR o.assigned_consultant_id = auth.uid()
                  OR ("sales-pipe".get_user_role() IN ('sales', 'consultant', 'sales_consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
                  OR ("sales-pipe".get_user_role() IN ('consultant', 'sales_consultant') AND o.stage = 'Consultation')
              )
        );
$fn$;

CREATE OR REPLACE FUNCTION "sales-pipe".check_opp_access(p_opportunity_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
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

    IF v_role IN ('sales', 'consultant', 'sales_consultant') AND v_opp.assigned_sales_id IS NULL AND v_opp.assigned_consultant_id IS NULL THEN
        RETURN; -- unassigned (review queue)
    END IF;

    IF v_role IN ('consultant', 'sales_consultant') AND v_opp.stage = 'Consultation' THEN
        RETURN; -- consultant access to consultation stage
    END IF;

    RAISE EXCEPTION 'You are not assigned to this business';
END;
$fn$;

CREATE OR REPLACE FUNCTION "sales-pipe".delete_leads(p_business_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
    v_count int := 0;
    v_bid uuid;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales', 'consultant']);

    FOR v_bid IN
        SELECT b.id
        FROM "sales-pipe".businesses b
        JOIN "sales-pipe".opportunities o ON o.business_id = b.id
        LEFT JOIN "sales-pipe".import_batches ib ON ib.id = b.import_batch_id
        WHERE b.id = ANY(p_business_ids)
          AND o.stage = 'Needs review'
          AND NOT EXISTS (
              SELECT 1 FROM "sales-pipe".threads t
              JOIN "sales-pipe".messages m ON m.thread_id = t.id
              WHERE t.opportunity_id = o.id
          )
          AND (
              v_role = 'admin'
              OR ib.uploaded_by = v_uid
              OR o.assigned_sales_id = v_uid
              OR o.assigned_consultant_id = v_uid
              OR (v_role IN ('sales', 'consultant', 'sales_consultant') AND o.assigned_sales_id IS NULL)
          )
    LOOP
        DELETE FROM "sales-pipe".businesses WHERE id = v_bid;
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$fn$;

CREATE OR REPLACE FUNCTION "sales-pipe".insights(p_from date, p_to date, p_service text DEFAULT NULL::text, p_user uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
DECLARE
    v_role text := "sales-pipe".get_user_role();
    v_uid uuid := auth.uid();
    v_from timestamptz := p_from::timestamptz;
    v_to timestamptz := (p_to + 1)::timestamptz;
    v_result jsonb;
BEGIN
    IF v_role IS NULL THEN RAISE EXCEPTION 'Your account is not set up'; END IF;
    IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN RAISE EXCEPTION 'Pick a valid date range'; END IF;

    WITH scope AS (
        SELECT o.* FROM "sales-pipe".opportunities o
        JOIN "sales-pipe".businesses b ON b.id = o.business_id AND NOT b.archived
        WHERE (nullif(p_service, '') IS NULL OR p_service = ANY(o.services_pitched))
          AND CASE v_role
                WHEN 'admin' THEN (p_user IS NULL OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user)
                WHEN 'sales' THEN o.assigned_sales_id = v_uid
                WHEN 'sales_consultant' THEN (o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid)
                ELSE o.assigned_consultant_id = v_uid
              END
    ),
    msgs AS (
        SELECT m.*, t.opportunity_id, t.platform
        FROM "sales-pipe".messages m
        JOIN "sales-pipe".threads t ON t.id = m.thread_id
        WHERE t.opportunity_id IN (SELECT id FROM scope)
    ),
    first_out AS (
        SELECT opportunity_id, min(created_at) AS at FROM msgs WHERE direction = 'outbound' GROUP BY opportunity_id
    ),
    cohort AS (
        SELECT s.* FROM scope s JOIN first_out f ON f.opportunity_id = s.id
        WHERE f.at >= v_from AND f.at < v_to
    ),
    reached_stage AS (
        SELECT c.id,
            EXISTS (SELECT 1 FROM msgs m WHERE m.opportunity_id = c.id AND m.direction = 'inbound') AS replied,
            (c.stage IN ('Interested', 'Consultation', 'Won')
             OR EXISTS (SELECT 1 FROM "sales-pipe".stage_changes sc WHERE sc.opportunity_id = c.id AND sc.to_stage IN ('Interested', 'Consultation', 'Won'))) AS interested,
            (c.stage = 'Consultation' OR c.converted_through = 'Consultation'
             OR EXISTS (SELECT 1 FROM "sales-pipe".stage_changes sc WHERE sc.opportunity_id = c.id AND sc.to_stage = 'Consultation')) AS consultation,
            (c.stage = 'Won') AS won
        FROM cohort c
    ),
    -- Threads of the cohort that got at least one message from us
    cohort_threads AS (
        SELECT t.id, t.platform,
            EXISTS (SELECT 1 FROM msgs m WHERE m.thread_id = t.id AND m.direction = 'inbound') AS replied
        FROM "sales-pipe".threads t
        WHERE t.opportunity_id IN (SELECT id FROM cohort)
          AND EXISTS (SELECT 1 FROM msgs m WHERE m.thread_id = t.id AND m.direction = 'outbound')
    ),
    -- For each thread's first reply: which of our messages came just before it
    first_reply AS (
        SELECT DISTINCT ON (m.thread_id) m.thread_id, m.created_at
        FROM msgs m WHERE m.direction = 'inbound' AND m.opportunity_id IN (SELECT id FROM cohort)
        ORDER BY m.thread_id, m.created_at
    ),
    reply_step AS (
        SELECT (SELECT coalesce(o.step_label, 'Other') FROM msgs o
                 WHERE o.thread_id = r.thread_id AND o.direction = 'outbound' AND o.created_at < r.created_at
                 ORDER BY o.created_at DESC LIMIT 1) AS step
        FROM first_reply r
    ),
    step_sent AS (
        SELECT step_label AS step, count(*) AS sent FROM msgs
        WHERE direction = 'outbound' AND opportunity_id IN (SELECT id FROM cohort)
          AND platform NOT IN ('Phone', 'Walk-in')   -- call and visit outcomes are notes, not replies
          AND step_label IN ('First contact', 'Follow-up 1', 'Follow-up 2', 'Final check')
        GROUP BY step_label
    ),
    wins AS (
        SELECT * FROM scope WHERE stage = 'Won' AND won_at >= v_from AND won_at < v_to
    ),
    -- Template use in the range: did they reply before our next message?
    tpl_msgs AS (
        SELECT m.id, m.thread_id, m.template_id, m.created_at,
            EXISTS (
                SELECT 1 FROM msgs i WHERE i.thread_id = m.thread_id AND i.direction = 'inbound' AND i.created_at > m.created_at
                  AND NOT EXISTS (SELECT 1 FROM msgs o2 WHERE o2.thread_id = m.thread_id AND o2.direction = 'outbound'
                                  AND o2.created_at > m.created_at AND o2.created_at < i.created_at)
            ) AS got_reply
        FROM msgs m
        WHERE m.direction = 'outbound' AND m.template_id IS NOT NULL AND m.created_at >= v_from AND m.created_at < v_to
    )
    SELECT jsonb_build_object(
        'totals', (SELECT jsonb_build_object(
            'reached', count(*),
            'replied', count(*) FILTER (WHERE replied),
            'interested', count(*) FILTER (WHERE interested),
            'consultation', count(*) FILTER (WHERE consultation),
            'won', count(*) FILTER (WHERE won)) FROM reached_stage),
        'platforms', coalesce((SELECT jsonb_agg(x ORDER BY x->>'platform') FROM (
            SELECT jsonb_build_object('platform', platform, 'sent', count(*), 'replied', count(*) FILTER (WHERE replied)) AS x
            FROM cohort_threads GROUP BY platform) p), '[]'::jsonb),
        'steps', coalesce((SELECT jsonb_agg(jsonb_build_object('step', s.step, 'sent', s.sent,
                    'replied', (SELECT count(*) FROM reply_step r WHERE r.step = s.step))
                  ORDER BY array_position(ARRAY['First contact', 'Follow-up 1', 'Follow-up 2', 'Final check'], s.step))
                  FROM step_sent s), '[]'::jsonb),
        'wins', jsonb_build_object(
            'total', (SELECT count(*) FROM wins),
            'conversion', coalesce((SELECT jsonb_object_agg(k, n) FROM (SELECT coalesce(conversion_type, 'Not recorded') k, count(*) n FROM wins GROUP BY 1) a), '{}'::jsonb),
            'through', coalesce((SELECT jsonb_object_agg(k, n) FROM (SELECT coalesce(converted_through, 'Not recorded') k, count(*) n FROM wins GROUP BY 1) a), '{}'::jsonb)),
        'templates', coalesce((SELECT jsonb_agg(x ORDER BY (x->>'replied')::numeric / greatest((x->>'sent')::numeric, 1) DESC, (x->>'sent')::int DESC) FROM (
            SELECT jsonb_build_object('name', t.name, 'platform', t.platform, 'step', t.step,
                                      'sent', count(*), 'replied', count(*) FILTER (WHERE got_reply)) AS x
            FROM tpl_msgs m JOIN "sales-pipe".templates t ON t.id = m.template_id
            GROUP BY t.id, t.name, t.platform, t.step) q), '[]'::jsonb)
    ) INTO v_result;

    RETURN v_result;
END;
$fn$;

CREATE OR REPLACE FUNCTION "sales-pipe".list_off_target_leads()
 RETURNS TABLE(business_id uuid, business_name text, business_type text, area text, opportunity_id uuid, stage text, reason text, noticed text, note text, marked_at timestamp with time zone, marked_by_name text)
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
    SELECT b.id, b.business_name, "sales-pipe".canonical_business_type(b.business_type), b.area,
           o.id, o.stage, b.off_target_reason, b.off_target_noticed, b.off_target_note,
           b.off_target_at, p.full_name
    FROM "sales-pipe".businesses b
    JOIN LATERAL (
        SELECT o2.id, o2.stage FROM "sales-pipe".opportunities o2
        WHERE o2.business_id = b.id
          AND (v_role = 'admin' OR auth.role() = 'service_role'
               OR o2.assigned_sales_id = v_uid OR o2.assigned_consultant_id = v_uid
               OR (v_role IN ('sales', 'consultant', 'sales_consultant') AND o2.assigned_sales_id IS NULL AND o2.assigned_consultant_id IS NULL)
               OR (v_role IN ('consultant', 'sales_consultant') AND o2.stage = 'Consultation'))
        ORDER BY o2.created_at DESC LIMIT 1
    ) o ON true
    LEFT JOIN "sales-pipe".profiles p ON p.id = b.off_target_by
    WHERE b.off_target_at IS NOT NULL AND NOT b.archived
    ORDER BY b.off_target_at DESC
    LIMIT 1000;
END;
$fn$;

CREATE OR REPLACE FUNCTION "sales-pipe".list_pitches(p_service text DEFAULT NULL::text, p_type text DEFAULT NULL::text, p_filter text DEFAULT 'all'::text, p_search text DEFAULT NULL::text, p_platform text DEFAULT NULL::text, p_assigned text DEFAULT NULL::text, p_include_archived boolean DEFAULT false, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0)
 RETURNS TABLE(opportunity_id uuid, business_id uuid, business_name text, business_type text, area text, postcode text, address text, google_rating numeric, phone text, email text, instagram text, facebook text, company_type text, contact_name text, archived boolean, stage text, services_pitched text[], services_won text[], assigned_sales_id uuid, assigned_sales_name text, assigned_consultant_name text, consultation_at timestamp with time zone, created_at timestamp with time zone, threads jsonb, next_due_on date, needs_reply boolean, total_count bigint, existing_website text, has_no_website boolean, whatsapp_number text, owner_contact text, owner_email text, tech_partner_type text, tech_partner_name text, gaps_found text)
 LANGUAGE plpgsql
 SECURITY DEFINER
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
    WITH base AS (
        SELECT o.*,
               b.business_name AS b_name,
               b.business_type AS b_type,
               b.area AS b_area,
               b.postcode AS b_pc,
               b.address AS b_address,
               b.google_rating AS b_rating,
               coalesce(b.whatsapp_number, b.phone) AS b_phone,
               b.email AS b_email,
               b.instagram AS b_ig,
               b.facebook AS b_fb,
               b.company_type AS b_ct,
               b.contact_name AS b_contact,
               b.archived AS b_archived,
               b.existing_website AS b_website,
               coalesce(b.has_no_website, false) AS b_no_website,
               b.whatsapp_number AS b_whatsapp,
               b.owner_contact AS b_owner_contact,
               b.owner_email AS b_owner_email,
               b.tech_partner_type AS b_tech_type,
               b.tech_partner_name AS b_tech_name,
               b.gaps_found AS b_gaps,
               EXISTS (SELECT 1 FROM "sales-pipe".threads t
                        WHERE t.opportunity_id = o.id AND t.status = 'Replied'
                          AND t.last_inbound_at > coalesce(t.last_outbound_at, '-infinity'))
               AND o.stage IN ('Active', 'Interested', 'Consultation') AS b_needs_reply
        FROM "sales-pipe".opportunities o
        JOIN "sales-pipe".businesses b ON b.id = o.business_id
        WHERE (p_include_archived OR NOT b.archived)
          AND (v_role = 'admin' OR auth.role() = 'service_role'
               OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
               OR (v_role IN ('sales', 'consultant', 'sales_consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
          AND (nullif(p_service, '') IS NULL OR p_service = ANY(o.services_pitched))
          AND (nullif(p_type, '') IS NULL 
               OR b.business_type = p_type 
               OR b.business_type = "sales-pipe".canonical_business_type(p_type))
          AND (nullif(p_search, '') IS NULL
               OR b.business_name ILIKE '%' || p_search || '%'
               OR b.area ILIKE '%' || p_search || '%'
               OR b.postcode ILIKE '%' || p_search || '%'
               OR b.phone_normalised = "sales-pipe".normalise_phone(p_search)
               OR b.email ILIKE '%' || p_search || '%')
          AND (nullif(p_platform, '') IS NULL OR EXISTS (
               SELECT 1 FROM "sales-pipe".threads t WHERE t.opportunity_id = o.id AND t.platform = p_platform))
          AND (nullif(p_assigned, '') IS NULL
               OR (p_assigned = 'me' AND (o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid))
               OR (p_assigned = 'unassigned' AND o.assigned_sales_id IS NULL)
               OR (p_assigned NOT IN ('me', 'unassigned') AND (o.assigned_sales_id::text = p_assigned OR o.assigned_consultant_id::text = p_assigned)))
    ),
    filtered AS (
        SELECT * FROM base
        WHERE coalesce(p_filter, 'all') = 'all'
           OR (p_filter = 'needs-reply' AND base.b_needs_reply)
           OR (p_filter = 'needs-consultant' AND base.stage = 'Consultation' AND base.assigned_consultant_id IS NULL)
           OR (p_filter = 'open' AND base.stage IN ('Active', 'Interested', 'Consultation'))
           OR (p_filter = 'Needs review' AND base.stage = 'Needs review' AND EXISTS (
               SELECT 1 FROM "sales-pipe".businesses b WHERE b.id = base.business_id AND b.problems = '{}'::text[]
           ))
           OR (p_filter NOT IN ('Needs review', 'needs-reply', 'needs-consultant', 'open', 'all') AND base.stage = p_filter)
    )
    SELECT f.id, f.business_id, f.b_name, f.b_type, f.b_area, f.b_pc, f.b_address, f.b_rating, f.b_phone, f.b_email,
           f.b_ig, f.b_fb, f.b_ct, f.b_contact, f.b_archived, f.stage, f.services_pitched, f.services_won,
           f.assigned_sales_id,
           (SELECT full_name FROM "sales-pipe".profiles WHERE id = f.assigned_sales_id),
           (SELECT full_name FROM "sales-pipe".profiles WHERE id = f.assigned_consultant_id),
           f.consultation_at, f.created_at,
           coalesce((SELECT jsonb_agg(jsonb_build_object(
                        'id', t.id, 'platform', t.platform, 'status', t.status, 'step', t.step,
                        'next_due_on', t.next_due_on, 'paused_reason', t.paused_reason)
                      ORDER BY array_position(ARRAY['WhatsApp','Instagram','Facebook','Email','LinkedIn'], t.platform))
                     FROM "sales-pipe".threads t WHERE t.opportunity_id = f.id), '[]'::jsonb),
           (SELECT min(t.next_due_on) FROM "sales-pipe".threads t
             WHERE t.opportunity_id = f.id AND t.next_due_on IS NOT NULL),
           f.b_needs_reply,
           count(*) OVER (),
           f.b_website,
           f.b_no_website,
           f.b_whatsapp,
           f.b_owner_contact,
           f.b_owner_email,
           f.b_tech_type,
           f.b_tech_name,
           f.b_gaps
    FROM filtered f
    ORDER BY
        CASE WHEN p_filter = 'Needs review' THEN f.created_at END DESC,
        f.b_needs_reply DESC,
        (SELECT min(t.next_due_on) FROM "sales-pipe".threads t WHERE t.opportunity_id = f.id) ASC NULLS LAST,
        f.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$fn$;

CREATE OR REPLACE FUNCTION "sales-pipe".missing_counts(p_type text DEFAULT NULL::text, p_problem text DEFAULT NULL::text, p_batch uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
    v_result jsonb;
BEGIN
    IF v_role IS NULL AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Your account is not set up';
    END IF;

    WITH base AS (
        SELECT b.id, b.business_type, b.problems
        FROM "sales-pipe".businesses b
        JOIN "sales-pipe".opportunities o ON o.business_id = b.id
        WHERE o.stage = 'Needs review'
          AND b.problems <> '{}'::text[]
          AND NOT b.archived
          AND (v_role = 'admin' OR auth.role() = 'service_role'
               OR o.assigned_sales_id = v_uid
               OR o.assigned_consultant_id = v_uid
               OR (v_role IN ('sales', 'consultant', 'sales_consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
          AND (p_batch IS NULL OR b.import_batch_id = p_batch)
    ),
    type_counts AS (
        SELECT coalesce(jsonb_agg(jsonb_build_object('business_type', t.cat, 'count', coalesce(cnt.c, 0))
               ORDER BY array_position(ARRAY['Hotel', 'Restaurant or cafe', 'Pub', 'Property management'], t.cat)), '[]'::jsonb) AS js
        FROM unnest(ARRAY['Hotel', 'Restaurant or cafe', 'Pub', 'Property management']) AS t(cat)
        LEFT JOIN (
            SELECT b.business_type, count(b.id)::int AS c
            FROM base b
            WHERE (nullif(p_problem, '') IS NULL OR p_problem = ANY(b.problems))
            GROUP BY b.business_type
        ) cnt ON cnt.business_type = t.cat
    ),
    prob_counts AS (
        SELECT coalesce(jsonb_agg(jsonb_build_object('problem', p.code, 'label', p.label, 'count', coalesce(cnt.c, 0))), '[]'::jsonb) AS js
        FROM (VALUES
            ('name', 'Business name'),
            ('website', 'Website'),
            ('location', 'Location'),
            ('postcode', 'Postcode'),
            ('category', 'Category'),
            ('service', 'Service'),
            ('owner_name', 'Owner name'),
            ('owner_contact', 'Owner contact'),
            ('business_contact', 'Business contact'),
            ('tech_partner', 'Tech partner'),
            ('gaps', 'Gaps found')
        ) AS p(code, label)
        LEFT JOIN (
            SELECT unnest(b.problems) AS prob, count(b.id)::int AS c
            FROM base b
            WHERE (nullif(p_type, '') IS NULL OR b.business_type = p_type)
            GROUP BY prob
        ) cnt ON cnt.prob = p.code
    ),
    total_count AS (
        SELECT count(DISTINCT b.id)::bigint AS tot
        FROM base b
        WHERE (nullif(p_type, '') IS NULL OR b.business_type = p_type)
          AND (nullif(p_problem, '') IS NULL OR p_problem = ANY(b.problems))
    )
    SELECT jsonb_build_object(
        'types', (SELECT js FROM type_counts),
        'problems', (SELECT js FROM prob_counts),
        'total', coalesce((SELECT tot FROM total_count), 0)
    ) INTO v_result;

    RETURN v_result;
END;
$fn$;

CREATE OR REPLACE FUNCTION "sales-pipe".missing_list(p_type text DEFAULT NULL::text, p_problem text DEFAULT NULL::text, p_batch uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(opportunity_id uuid, business_id uuid, business_name text, business_type text, existing_website text, has_no_website boolean, address text, postcode text, branches jsonb, services text[], contact_name text, owner_email text, owner_contact text, email text, whatsapp_number text, instagram text, facebook text, linkedin text, tech_partner_type text, tech_partner_name text, gaps_found text, source text, import_batch_id uuid, batch_file_name text, batch_uploaded_at timestamp with time zone, problems text[], total_count bigint)
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
    WITH rows AS (
        SELECT
            o.id AS r_opportunity_id,
            b.id AS r_business_id,
            b.business_name AS r_business_name,
            b.business_type AS r_business_type,
            b.existing_website AS r_existing_website,
            coalesce(b.has_no_website, false) AS r_has_no_website,
            b.address AS r_address,
            b.postcode AS r_postcode,
            coalesce(b.branches, '[]'::jsonb) AS r_branches,
            o.services_pitched AS r_services,
            b.contact_name AS r_contact_name,
            b.owner_email AS r_owner_email,
            b.owner_contact AS r_owner_contact,
            b.email AS r_email,
            b.whatsapp_number AS r_whatsapp_number,
            b.instagram AS r_instagram,
            b.facebook AS r_facebook,
            b.linkedin AS r_linkedin,
            b.tech_partner_type AS r_tech_partner_type,
            b.tech_partner_name AS r_tech_partner_name,
            b.gaps_found AS r_gaps_found,
            b.source AS r_source,
            b.import_batch_id AS r_import_batch_id,
            ib.file_name AS r_batch_file_name,
            ib.created_at AS r_batch_uploaded_at,
            b.problems AS r_problems
        FROM "sales-pipe".businesses b
        JOIN "sales-pipe".opportunities o ON o.business_id = b.id
        LEFT JOIN "sales-pipe".import_batches ib ON ib.id = b.import_batch_id
        WHERE o.stage = 'Needs review'
          AND b.problems <> '{}'::text[]
          AND NOT b.archived
          AND (v_role = 'admin' OR auth.role() = 'service_role'
               OR o.assigned_sales_id = v_uid
               OR o.assigned_consultant_id = v_uid
               OR (v_role IN ('sales', 'consultant', 'sales_consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
          AND (nullif(p_type, '') IS NULL OR b.business_type = p_type)
          AND (nullif(p_problem, '') IS NULL OR p_problem = ANY(b.problems))
          AND (p_batch IS NULL OR b.import_batch_id = p_batch)
    )
    SELECT
        r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type,
        r.r_existing_website, r.r_has_no_website, r.r_address, r.r_postcode,
        r.r_branches, r.r_services, r.r_contact_name, r.r_owner_email,
        r.r_owner_contact,
        r.r_email, r.r_whatsapp_number, r.r_instagram, r.r_facebook, r.r_linkedin,
        r.r_tech_partner_type, r.r_tech_partner_name,
        r.r_gaps_found, r.r_source, r.r_import_batch_id, r.r_batch_file_name,
        r.r_batch_uploaded_at, r.r_problems,
        count(*) OVER () AS total_count
    FROM rows r
    ORDER BY r.r_business_name ASC
    LIMIT p_limit OFFSET p_offset;
END;
$fn$;

CREATE OR REPLACE FUNCTION "sales-pipe".new_pitch(p_business_id uuid, p_services text[], p_source_opportunity_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
DECLARE v_id uuid;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales', 'consultant']);
    IF p_services IS NULL OR array_length(p_services, 1) IS NULL THEN RAISE EXCEPTION 'Pick at least one service'; END IF;
    IF NOT (p_services <@ "sales-pipe".valid_services()) THEN RAISE EXCEPTION 'Unknown service'; END IF;
    INSERT INTO "sales-pipe".opportunities (business_id, services_pitched, stage, source_opportunity_id, assigned_sales_id)
    VALUES (p_business_id, p_services, 'Needs review', p_source_opportunity_id,
            CASE WHEN "sales-pipe".get_user_role() IN ('sales', 'sales_consultant') THEN auth.uid() END)
    RETURNING id INTO v_id;
    RETURN v_id;
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
               OR (v_role IN ('sales', 'consultant', 'sales_consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
               OR (v_role IN ('consultant', 'sales_consultant') AND o.stage = 'Consultation'))
          AND (nullif(p_type, '') IS NULL OR "sales-pipe".canonical_business_type(b.business_type) = "sales-pipe".canonical_business_type(p_type))
    )
    SELECT p.p_name AS platform, count(m.platform)::bigint AS count
    FROM platforms p
    LEFT JOIN matching_threads m ON m.platform = p.p_name
    GROUP BY p.p_name
    ORDER BY array_position(ARRAY['WhatsApp', 'Instagram', 'Facebook', 'Email', 'LinkedIn'], p.p_name);
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
                   OR (v_role IN ('sales', 'consultant', 'sales_consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
                   OR (v_role IN ('consultant', 'sales_consultant') AND o.stage = 'Consultation'))
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
                   OR (v_role IN ('sales', 'consultant', 'sales_consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
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
                   OR (v_role IN ('sales', 'consultant', 'sales_consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
                   OR (v_role IN ('consultant', 'sales_consultant') AND o.stage = 'Consultation'))
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
                   OR (v_role IN ('sales', 'consultant', 'sales_consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
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
                   OR (v_role IN ('sales', 'consultant', 'sales_consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
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
               OR (v_role IN ('sales', 'consultant', 'sales_consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
               OR (v_role IN ('consultant', 'sales_consultant') AND o.stage = 'Consultation'))
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
               OR (v_role IN ('sales', 'consultant', 'sales_consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
               OR (v_role IN ('consultant', 'sales_consultant') AND o.stage = 'Consultation'))
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

CREATE OR REPLACE FUNCTION "sales-pipe".sync_profile_from_matrix(p_employee_id integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $fn$
DECLARE
  v_emp  record;
  v_role text;
BEGIN
  SELECT e.auth_user_id, e.full_name, e.status INTO v_emp
  FROM hr.employees e WHERE e.id = p_employee_id;
  IF NOT FOUND OR v_emp.auth_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT CASE pr.code WHEN 'admin' THEN 'admin' WHEN 'consultant' THEN 'consultant' WHEN 'sales_consultant' THEN 'sales_consultant' ELSE 'sales' END
  INTO v_role
  FROM public.user_product_access upa
  JOIN public.products p      ON p.product_id = upa.product_id AND p.code = 'sales_pipeline'
  JOIN public.product_roles pr ON pr.id = upa.product_role_id
  WHERE upa.employee_id = p_employee_id;

  -- Same rule as the Admin Panel's sign-in: only terminated employees are blocked
  IF v_role IS NOT NULL AND v_emp.status <> 'terminated' THEN
    INSERT INTO "sales-pipe".profiles (id, full_name, role, is_active)
    VALUES (v_emp.auth_user_id, v_emp.full_name, v_role, true)
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = true;
  ELSE
    UPDATE "sales-pipe".profiles SET is_active = false WHERE id = v_emp.auth_user_id;
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION "sales-pipe".update_lead_field(p_business_id uuid, p_field text, p_value text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
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
               OR (v_role IN ('sales', 'consultant', 'sales_consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
               OR (v_role IN ('consultant', 'sales_consultant') AND o.stage = 'Consultation'))
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
$fn$;

CREATE OR REPLACE FUNCTION "sales-pipe".v_business_type_counts(p_service text, p_user uuid)
 RETURNS TABLE(business_type text, businesses_count bigint, replies_count bigint, due_today_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
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
           OR (v_role IN ('sales', 'consultant', 'sales_consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
           OR (v_role IN ('consultant', 'sales_consultant') AND o.stage = 'Consultation'))
    GROUP BY b.business_type
    ORDER BY count(DISTINCT b.id) DESC;
END;
$fn$;

CREATE OR REPLACE FUNCTION "sales-pipe".v_dashboard_status_counts(p_user uuid)
 RETURNS TABLE(needs_reply bigint, interested bigint, consultation bigint, went_cold bigint, no_response bigint, needs_consultant bigint, off_target bigint, needs_review bigint, total_pitches bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
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
           OR (v_role IN ('sales', 'consultant', 'sales_consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
           OR (v_role IN ('consultant', 'sales_consultant') AND o.stage = 'Consultation')
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
$fn$;

COMMIT;

NOTIFY pgrst, 'reload schema';
