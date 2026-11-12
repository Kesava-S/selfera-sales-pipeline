-- ==============================================================================
-- 68_consultant_no_import_campaigns.sql
-- Consultants run consultations only: no lead import (CSV import, duplicate
-- check, import batches, approval queue) and no email / WhatsApp campaigns.
-- Admin and sales keep both. Consultants can still edit, note and mark the
-- leads handed over to them.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

-- Campaigns and their saved contact lists: admin and sales only
DROP POLICY IF EXISTS email_campaigns_access ON "sales-pipe".email_campaigns;
CREATE POLICY email_campaigns_access ON "sales-pipe".email_campaigns FOR ALL
    USING (coalesce("sales-pipe".get_user_role(), '') IN ('admin', 'sales'))
    WITH CHECK (coalesce("sales-pipe".get_user_role(), '') IN ('admin', 'sales'));
DROP POLICY IF EXISTS whatsapp_campaigns_access ON "sales-pipe".whatsapp_campaigns;
CREATE POLICY whatsapp_campaigns_access ON "sales-pipe".whatsapp_campaigns FOR ALL
    USING (coalesce("sales-pipe".get_user_role(), '') IN ('admin', 'sales'))
    WITH CHECK (coalesce("sales-pipe".get_user_role(), '') IN ('admin', 'sales'));
DROP POLICY IF EXISTS email_databases_access ON "sales-pipe".email_databases;
CREATE POLICY email_databases_access ON "sales-pipe".email_databases FOR ALL
    USING (coalesce("sales-pipe".get_user_role(), '') IN ('admin', 'sales'))
    WITH CHECK (coalesce("sales-pipe".get_user_role(), '') IN ('admin', 'sales'));
DROP POLICY IF EXISTS whatsapp_databases_access ON "sales-pipe".whatsapp_databases;
CREATE POLICY whatsapp_databases_access ON "sales-pipe".whatsapp_databases FOR ALL
    USING (coalesce("sales-pipe".get_user_role(), '') IN ('admin', 'sales'))
    WITH CHECK (coalesce("sales-pipe".get_user_role(), '') IN ('admin', 'sales'));

-- Import and campaign functions: admin and sales only (bodies otherwise unchanged)

CREATE OR REPLACE FUNCTION "sales-pipe".create_import_batch(p_file_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
    DECLARE
        v_id uuid;
    BEGIN
        PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales']);
        INSERT INTO "sales-pipe".import_batches (file_name, uploaded_by)
        VALUES (coalesce(nullif(trim(p_file_name), ''), 'leads.csv'), auth.uid())
        RETURNING id INTO v_id;
        RETURN v_id;
    END;
    $fn$;

CREATE OR REPLACE FUNCTION "sales-pipe".import_businesses(p_rows jsonb, p_batch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
DECLARE
    x jsonb;
    v_bid uuid;
    v_action text;
    v_name text;
    v_type text;
    v_services text[];
    v_tech_type text;
    v_tech_name text;
    v_branches jsonb;
    v_raw_branches text;
    v_ready int := 0;
    v_missing int := 0;
    v_skipped int := 0;
    v_probs text[];
    b_str text;
    v_raw_services text;
    v_raw_tp text;
    v_site text;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales']);

    FOR x IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
        v_action := coalesce(x->>'action', 'new');
        v_name := trim(coalesce(x->>'business_name', ''));

        IF v_action = 'skip' THEN
            v_skipped := v_skipped + 1;
            CONTINUE;
        END IF;

        IF v_action IN ('new', 'update') THEN
            -- Services parsing (handles JSON array e.g. ["Website"] and comma-separated string)
            IF x->'services' IS NOT NULL AND jsonb_typeof(x->'services') = 'array' THEN
                SELECT coalesce(array_agg(trim(val)), '{}'::text[]) INTO v_services
                FROM jsonb_array_elements_text(x->'services') val
                WHERE trim(val) = ANY("sales-pipe".valid_services());
            ELSIF x->'services_pitched' IS NOT NULL AND jsonb_typeof(x->'services_pitched') = 'array' THEN
                SELECT coalesce(array_agg(trim(val)), '{}'::text[]) INTO v_services
                FROM jsonb_array_elements_text(x->'services_pitched') val
                WHERE trim(val) = ANY("sales-pipe".valid_services());
            ELSE
                v_raw_services := trim(coalesce(x->>'services', x->>'services_pitched', ''));
                SELECT coalesce(array_agg(trim(s)), '{}'::text[]) INTO v_services
                FROM unnest(string_to_array(v_raw_services, ',')) s
                WHERE trim(s) = ANY("sales-pipe".valid_services());
            END IF;
            IF v_services IS NULL THEN
                v_services := '{}'::text[];
            END IF;

            v_type := nullif(trim(x->>'business_type'), '');
            IF v_type IS NOT NULL AND v_type NOT IN ('Hotel', 'Restaurant or cafe', 'Pub', 'Property management') THEN
                v_type := "sales-pipe".canonical_business_type(v_type);
            END IF;

            -- Website normalization
            v_site := nullif(trim(x->>'existing_website'), '');
            IF v_site IS NOT NULL AND v_site !~* '^https?://' AND v_site ~* '^[^\s.]+\.[^\s]{2,}' THEN
                v_site := 'https://' || v_site;
            END IF;

            -- Tech partner parsing
            v_tech_type := nullif(trim(x->>'tech_partner_type'), '');
            v_raw_tp := nullif(trim(coalesce(x->>'tech_partner', x->>'existing_tech_partner', '')), '');
            IF v_tech_type IS NULL AND v_raw_tp IS NOT NULL THEN
                IF lower(v_raw_tp) = 'none' THEN
                    v_tech_type := 'None';
                    v_tech_name := NULL;
                ELSIF v_raw_tp ~* '^Agency' THEN
                    v_tech_type := 'Agency';
                    v_tech_name := nullif(btrim(regexp_replace(v_raw_tp, '^Agency\s*', '', 'i'), ' ()'), '');
                ELSIF v_raw_tp ~* '^DIY' THEN
                    v_tech_type := 'DIY';
                    v_tech_name := nullif(btrim(regexp_replace(v_raw_tp, '^DIY\s*', '', 'i'), ' ()'), '');
                ELSE
                    v_tech_type := 'Agency';
                    v_tech_name := v_raw_tp;
                END IF;
            END IF;
            IF v_tech_type IS NOT NULL AND v_tech_type NOT IN ('Agency', 'DIY', 'None') THEN
                v_tech_type := NULL;
            END IF;
            IF v_tech_name IS NULL THEN
                v_tech_name := nullif(trim(x->>'tech_partner_name'), '');
            END IF;

            -- Branches parsing
            IF x->'branches' IS NOT NULL AND jsonb_typeof(x->'branches') = 'array' THEN
                v_branches := x->'branches';
            ELSIF nullif(trim(x->>'branches'), '') IS NOT NULL THEN
                v_raw_branches := trim(x->>'branches');
                SELECT jsonb_agg(jsonb_build_object(
                    'name', trim(split_part(b_str, '|', 1)),
                    'address', trim(split_part(b_str, '|', 2)),
                    'postcode', upper(trim(split_part(b_str, '|', 3)))
                )) INTO v_branches
                FROM unnest(string_to_array(v_raw_branches, ';')) b_str
                WHERE trim(b_str) <> '';
            ELSE
                v_branches := '[]'::jsonb;
            END IF;

            IF v_action = 'new' THEN
                INSERT INTO "sales-pipe".businesses (
                    business_name, business_type, category, tier, room_count, area, address, postcode, maps_link,
                    google_rating, google_reviews_count, whatsapp_number, email, instagram, facebook, linkedin,
                    existing_website, company_type, contact_name, notes, owner_contact, gaps_found, has_no_website,
                    owner_email, tech_partner_type, tech_partner_name, branches, source, import_batch_id)
                VALUES (
                    v_name, v_type, "sales-pipe".type_category(v_type),
                    nullif(x->>'tier', ''), nullif(x->>'room_count', '')::int,
                    nullif(trim(x->>'area'), ''), nullif(trim(x->>'address'), ''), upper(nullif(trim(x->>'postcode'), '')),
                    nullif(trim(x->>'maps_link'), ''),
                    nullif(x->>'google_rating', '')::numeric, nullif(regexp_replace(coalesce(x->>'google_reviews_count', ''), '\D', '', 'g'), '')::int,
                    nullif(trim(x->>'whatsapp_number'), ''),
                    nullif(lower(trim(x->>'email')), ''),
                    "sales-pipe".clean_handle(x->>'instagram'), "sales-pipe".clean_handle(x->>'facebook'), nullif(trim(x->>'linkedin'), ''),
                    v_site,
                    coalesce(nullif(x->>'company_type', ''), 'Unknown'),
                    nullif(trim(x->>'contact_name'), ''), nullif(trim(x->>'notes'), ''),
                    coalesce(nullif(trim(x->>'owner_contact'), ''), nullif(trim(x->>'owner_whatsapp'), ''), nullif(trim(x->>'owner_social'), '')),
                    nullif(trim(x->>'gaps_found'), ''),
                    coalesce((x->>'has_no_website')::boolean, (lower(trim(coalesce(x->>'no_site', ''))) IN ('true', 'yes', '1', 't'))),
                    nullif(lower(trim(x->>'owner_email')), ''),
                    v_tech_type, v_tech_name, coalesce(v_branches, '[]'::jsonb), nullif(trim(x->>'source'), ''), p_batch_id)
                RETURNING id INTO v_bid;

                PERFORM "sales-pipe".add_pitch(v_bid, v_services, nullif(trim(x->>'demo_link'), ''));

                UPDATE "sales-pipe".businesses SET problems = "sales-pipe".lead_problems(v_bid) WHERE id = v_bid RETURNING problems INTO v_probs;
                IF array_length(v_probs, 1) IS NULL THEN
                    v_ready := v_ready + 1;
                ELSE
                    v_missing := v_missing + 1;
                END IF;
            ELSE
                v_bid := (x->>'match_id')::uuid;
                IF v_bid IS NOT NULL THEN
                    UPDATE "sales-pipe".businesses b SET
                        business_name = coalesce(nullif(v_name, ''), b.business_name),
                        business_type = coalesce(v_type, b.business_type),
                        category = coalesce("sales-pipe".type_category(v_type), b.category),
                        tier = coalesce(nullif(x->>'tier', ''), b.tier),
                        room_count = coalesce(nullif(x->>'room_count', '')::int, b.room_count),
                        area = coalesce(nullif(trim(x->>'area'), ''), b.area),
                        address = coalesce(nullif(trim(x->>'address'), ''), b.address),
                        postcode = coalesce(upper(nullif(trim(x->>'postcode'), '')), b.postcode),
                        maps_link = coalesce(nullif(trim(x->>'maps_link'), ''), b.maps_link),
                        google_rating = coalesce(nullif(x->>'google_rating', '')::numeric, b.google_rating),
                        google_reviews_count = coalesce(nullif(regexp_replace(coalesce(x->>'google_reviews_count', ''), '\D', '', 'g'), '')::int, b.google_reviews_count),
                        whatsapp_number = coalesce(nullif(trim(x->>'whatsapp_number'), ''), b.whatsapp_number),
                        email = coalesce(nullif(lower(trim(x->>'email')), ''), b.email),
                        instagram = coalesce("sales-pipe".clean_handle(x->>'instagram'), b.instagram),
                        facebook = coalesce("sales-pipe".clean_handle(x->>'facebook'), b.facebook),
                        linkedin = coalesce(nullif(trim(x->>'linkedin'), ''), b.linkedin),
                        existing_website = coalesce(v_site, b.existing_website),
                        company_type = coalesce(nullif(x->>'company_type', ''), b.company_type),
                        contact_name = coalesce(nullif(trim(x->>'contact_name'), ''), b.contact_name),
                        notes = CASE WHEN nullif(trim(x->>'notes'), '') IS NOT NULL THEN concat_ws('; ', b.notes, trim(x->>'notes')) ELSE b.notes END,
                        owner_contact = coalesce(nullif(trim(x->>'owner_contact'), ''), nullif(trim(x->>'owner_whatsapp'), ''), nullif(trim(x->>'owner_social'), ''), b.owner_contact),
                        owner_email = coalesce(nullif(lower(trim(x->>'owner_email')), ''), b.owner_email),
                        tech_partner_type = coalesce(v_tech_type, b.tech_partner_type),
                        tech_partner_name = coalesce(v_tech_name, b.tech_partner_name),
                        branches = CASE WHEN v_branches IS NOT NULL AND jsonb_array_length(v_branches) > 0 THEN v_branches ELSE b.branches END,
                        source = coalesce(nullif(trim(x->>'source'), ''), b.source),
                        import_batch_id = coalesce(p_batch_id, b.import_batch_id),
                        gaps_found = coalesce(nullif(trim(x->>'gaps_found'), ''), b.gaps_found),
                        has_no_website = coalesce((x->>'has_no_website')::boolean, (lower(trim(coalesce(x->>'no_site', ''))) IN ('true', 'yes', '1', 't')), b.has_no_website)
                    WHERE b.id = v_bid;

                    IF array_length(v_services, 1) > 0 THEN
                        UPDATE "sales-pipe".opportunities SET services_pitched = v_services
                        WHERE business_id = v_bid AND stage = 'Needs review';
                    END IF;

                    UPDATE "sales-pipe".businesses SET problems = "sales-pipe".lead_problems(v_bid) WHERE id = v_bid RETURNING problems INTO v_probs;
                    IF array_length(v_probs, 1) IS NULL THEN
                        v_ready := v_ready + 1;
                    ELSE
                        v_missing := v_missing + 1;
                    END IF;
                END IF;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'ready', v_ready,
        'missing', v_missing,
        'skipped', v_skipped,
        'total', v_ready + v_missing + v_skipped
    );
END;
$fn$;

CREATE OR REPLACE FUNCTION "sales-pipe".find_duplicates(p_rows jsonb)
 RETURNS TABLE(idx integer, business_id uuid, business_name text, matched_by text, open_pitches integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
    BEGIN
        PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales']);
        RETURN QUERY
        WITH r AS (
            SELECT (x->>'idx')::int AS idx,
                   lower(trim(x->>'business_name')) AS name,
                   "sales-pipe".normalise_phone(coalesce(x->>'whatsapp_number', x->>'phone')) AS phone,
                   "sales-pipe".normalise_email(x->>'email') AS email,
                   lower(trim(coalesce(x->>'linkedin', ''))) AS linkedin,
                   upper(regexp_replace(coalesce(x->>'postcode', ''), '\s', '', 'g')) AS pc
            FROM jsonb_array_elements(p_rows) x
        )
        SELECT DISTINCT ON (r.idx) r.idx, b.id, b.business_name,
               CASE WHEN r.email IS NOT NULL AND b.email_normalised = r.email THEN 'email'
                    WHEN r.phone IS NOT NULL AND (b.whatsapp_number IS NOT NULL AND "sales-pipe".normalise_phone(b.whatsapp_number) = r.phone) THEN 'whatsapp'
                    WHEN r.linkedin <> '' AND lower(b.linkedin) = r.linkedin THEN 'linkedin'
                    ELSE 'name and postcode' END,
               (SELECT count(*)::int FROM "sales-pipe".opportunities o
                 WHERE o.business_id = b.id AND o.stage NOT IN ('Won', 'Declined', 'Do not contact', 'No response', 'Went cold'))
        FROM r
        JOIN "sales-pipe".businesses b ON
              (r.email IS NOT NULL AND b.email_normalised = r.email)
           OR (r.phone IS NOT NULL AND b.whatsapp_number IS NOT NULL AND "sales-pipe".normalise_phone(b.whatsapp_number) = r.phone)
           OR (r.linkedin <> '' AND b.linkedin IS NOT NULL AND lower(b.linkedin) = r.linkedin)
           OR (r.pc <> '' AND lower(b.business_name) = r.name
               AND upper(regexp_replace(coalesce(b.postcode, ''), '\s', '', 'g')) = r.pc)
        ORDER BY r.idx;
    END;
    $fn$;

CREATE OR REPLACE FUNCTION "sales-pipe".approve_import(p_business_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
DECLARE
    b record;
    opp record;
    platforms text[];
    p text;
    approved uuid[] := '{}';
    t record;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales']);

    -- Refuse any lead whose problems is not empty
    FOR b IN SELECT id, business_name, problems FROM "sales-pipe".businesses WHERE id = ANY(p_business_ids) AND NOT archived LOOP
        IF array_length(b.problems, 1) > 0 THEN
            RAISE EXCEPTION 'Fix missing data first for %', b.business_name;
        END IF;
    END LOOP;

    FOR b IN SELECT * FROM "sales-pipe".businesses WHERE id = ANY(p_business_ids) AND NOT archived LOOP
        FOR opp IN SELECT * FROM "sales-pipe".opportunities WHERE business_id = b.id AND stage = 'Needs review' LOOP
            PERFORM "sales-pipe".check_opp_access(opp.id);

            platforms := '{}';
            IF b.email IS NOT NULL THEN platforms := array_append(platforms, 'Email'); END IF;
            IF coalesce(b.whatsapp_number, '') <> '' THEN
                platforms := array_append(platforms, 'WhatsApp');
            END IF;
            IF b.instagram IS NOT NULL THEN platforms := array_append(platforms, 'Instagram'); END IF;
            IF b.facebook IS NOT NULL THEN platforms := array_append(platforms, 'Facebook'); END IF;
            IF b.linkedin IS NOT NULL THEN platforms := array_append(platforms, 'LinkedIn'); END IF;

            -- Default to WhatsApp or Email if any
            IF array_length(platforms, 1) IS NULL THEN
                platforms := ARRAY['Email'];
            END IF;

            FOREACH p IN ARRAY platforms LOOP
                INSERT INTO "sales-pipe".threads (opportunity_id, platform, status, step, next_due_on)
                VALUES (opp.id, p, 'Not contacted', 0, CURRENT_DATE)
                ON CONFLICT (opportunity_id, platform) DO NOTHING;
            END LOOP;

            UPDATE "sales-pipe".opportunities SET stage = 'Active' WHERE id = opp.id;
            INSERT INTO "sales-pipe".stage_changes (opportunity_id, from_stage, to_stage, reason, changed_by)
            VALUES (opp.id, 'Needs review', 'Active', 'Approved from review queue', auth.uid());
            approved := array_append(approved, opp.id);
        END LOOP;
    END LOOP;

    PERFORM "sales-pipe".auto_assign_sales(
        ARRAY(SELECT id FROM "sales-pipe".opportunities WHERE id = ANY(approved) AND assigned_sales_id IS NULL)
    );

    FOR t IN SELECT id FROM "sales-pipe".threads WHERE opportunity_id = ANY(approved) AND status = 'Not contacted' LOOP
        PERFORM "sales-pipe".generate_draft(t.id, 'First contact');
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
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales']);

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

CREATE OR REPLACE FUNCTION "sales-pipe".retry_failed_campaign_sends(p_channel text, p_campaign_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $fn$
DECLARE
    v_count int;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales']);

    UPDATE "sales-pipe".campaign_recipients
    SET status = 'queued', attempts = 0, next_attempt_at = now(), error_detail = NULL, locked_at = NULL, updated_at = now()
    WHERE status = 'failed'
      AND ((p_channel = 'email' AND campaign_id = p_campaign_id)
        OR (p_channel = 'whatsapp' AND whatsapp_campaign_id = p_campaign_id));
    GET DIAGNOSTICS v_count = ROW_COUNT;

    IF v_count > 0 THEN
        IF p_channel = 'email' THEN
            UPDATE "sales-pipe".email_campaigns SET status = 'sending', updated_at = now() WHERE id = p_campaign_id;
        ELSE
            UPDATE "sales-pipe".whatsapp_campaigns SET status = 'sending', updated_at = now() WHERE id = p_campaign_id;
        END IF;
    END IF;

    RETURN v_count;
END;
$fn$;

COMMIT;

NOTIFY pgrst, 'reload schema';
