-- ==============================================================================
-- 35_csv_validation_queues.sql
-- CSV import with automatic validation, Approval queue and Missing data step:
-- 1. New columns on businesses: owner_email, owner_whatsapp, owner_social,
--    tech_partner_type, tech_partner_name, branches, source, import_batch_id, problems.
-- 2. New table import_batches.
-- 3. lead_problems function + automated triggers on businesses and opportunities.
-- 4. approve_import refuses any lead with problems <> '{}'.
-- 5. import_businesses saves all rows with business_name into Needs review,
--    tracking batch counts.
-- 6. missing_counts, missing_list, update_lead_field, bulk_set_field, delete_leads,
--    and list_import_batches.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

-- ------------------------------------------------------------------------------
-- 1. Table: import_batches
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "sales-pipe".import_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name text NOT NULL,
    uploaded_by uuid REFERENCES "sales-pipe".profiles(id),
    created_at timestamptz DEFAULT now(),
    total_rows int DEFAULT 0,
    ready_count int DEFAULT 0,
    missing_count int DEFAULT 0,
    failed_count int DEFAULT 0
);

ALTER TABLE "sales-pipe".import_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "import_batches_read" ON "sales-pipe".import_batches;
CREATE POLICY "import_batches_read" ON "sales-pipe".import_batches
    FOR SELECT TO authenticated
    USING ("sales-pipe".get_user_role() IS NOT NULL);

REVOKE ALL ON "sales-pipe".import_batches FROM anon, public;
GRANT SELECT ON "sales-pipe".import_batches TO authenticated;
GRANT ALL ON "sales-pipe".import_batches TO service_role;

-- ------------------------------------------------------------------------------
-- 2. New columns on businesses
-- ------------------------------------------------------------------------------
ALTER TABLE "sales-pipe".businesses
    ADD COLUMN IF NOT EXISTS owner_email text,
    ADD COLUMN IF NOT EXISTS owner_whatsapp text,
    ADD COLUMN IF NOT EXISTS owner_social text,
    ADD COLUMN IF NOT EXISTS tech_partner_type text,
    ADD COLUMN IF NOT EXISTS tech_partner_name text,
    ADD COLUMN IF NOT EXISTS branches jsonb DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS source text,
    ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES "sales-pipe".import_batches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS problems text[] DEFAULT '{}'::text[];

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'businesses_tech_partner_type_check'
    ) THEN
        ALTER TABLE "sales-pipe".businesses
            ADD CONSTRAINT businesses_tech_partner_type_check
            CHECK (tech_partner_type IS NULL OR tech_partner_type IN ('Agency', 'DIY', 'None'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_businesses_problems ON "sales-pipe".businesses USING gin(problems);
CREATE INDEX IF NOT EXISTS idx_businesses_batch ON "sales-pipe".businesses(import_batch_id);

-- ------------------------------------------------------------------------------
-- 3. Postcode validator helper
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".is_valid_uk_postcode(p_pc text)
RETURNS boolean AS $$
    SELECT upper(trim(coalesce(p_pc, ''))) ~ '^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$';
$$ LANGUAGE sql IMMUTABLE;

-- ------------------------------------------------------------------------------
-- 4. Problem calculation function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".compute_business_problems(b "sales-pipe".businesses)
RETURNS text[] AS $$
DECLARE
    v_problems text[] := '{}';
    v_has_owner_contact boolean := false;
    v_has_biz_contact boolean := false;
    v_has_tech_partner boolean := false;
    v_branch jsonb;
    v_branches_valid boolean := true;
    v_branches_postcode_valid boolean := true;
BEGIN
    -- 1. Business name: present
    IF coalesce(trim(b.business_name), '') = '' THEN
        v_problems := array_append(v_problems, 'name');
    END IF;

    -- 2. Website: valid link (http/https) OR has_no_website = true
    IF NOT coalesce(b.has_no_website, false) THEN
        IF coalesce(trim(b.existing_website), '') = ''
           OR trim(b.existing_website) !~* '^https?://[^\s.]+\.[^\s]{2,}' THEN
            v_problems := array_append(v_problems, 'website');
        END IF;
    END IF;

    -- 3. Location & Postcode: at least one address with a valid UK postcode.
    --    Groups: list each branch (name + address + postcode)
    IF b.branches IS NOT NULL AND jsonb_typeof(b.branches) = 'array' AND jsonb_array_length(b.branches) > 0 THEN
        FOR v_branch IN SELECT * FROM jsonb_array_elements(b.branches) LOOP
            IF coalesce(trim(v_branch->>'name'), '') = '' OR coalesce(trim(v_branch->>'address'), '') = '' THEN
                v_branches_valid := false;
            END IF;
            IF NOT "sales-pipe".is_valid_uk_postcode(v_branch->>'postcode') THEN
                v_branches_postcode_valid := false;
            END IF;
        END LOOP;
        IF NOT v_branches_valid THEN
            v_problems := array_append(v_problems, 'location');
        END IF;
        IF NOT v_branches_postcode_valid THEN
            v_problems := array_append(v_problems, 'postcode');
        END IF;
    ELSE
        IF coalesce(trim(b.address), '') = '' THEN
            v_problems := array_append(v_problems, 'location');
        END IF;
        IF NOT "sales-pipe".is_valid_uk_postcode(b.postcode) THEN
            v_problems := array_append(v_problems, 'postcode');
        END IF;
    END IF;

    -- 4. Category (business_type): Hotel, Restaurant or cafe, Pub, Property management
    IF b.business_type IS NULL OR b.business_type NOT IN ('Hotel', 'Restaurant or cafe', 'Pub', 'Property management') THEN
        v_problems := array_append(v_problems, 'category');
    END IF;

    -- 5. Service: at least one of the existing services
    IF NOT EXISTS (
        SELECT 1 FROM "sales-pipe".opportunities o
        WHERE o.business_id = b.id
          AND array_length(o.services_pitched, 1) > 0
          AND o.services_pitched <@ "sales-pipe".valid_services()
    ) THEN
        v_problems := array_append(v_problems, 'service');
    END IF;

    -- 6. Owner name: present (contact_name column)
    IF coalesce(trim(b.contact_name), '') = '' THEN
        v_problems := array_append(v_problems, 'owner_name');
    END IF;

    -- 7. Owner contact: at least one valid of: email, UK mobile (07 or +447), LinkedIn or social link
    IF coalesce(trim(b.owner_email), '') ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'
       OR coalesce(trim(b.owner_contact), '') ~* '[^\s@]+@[^\s@]+\.[^\s@]{2,}' THEN
        v_has_owner_contact := true;
    ELSIF regexp_replace(coalesce(b.owner_whatsapp, ''), '\D', '', 'g') ~ '^(07\d{9}|447\d{9})$'
       OR regexp_replace(coalesce(b.owner_contact, ''), '\D', '', 'g') ~ '^(07\d{9}|447\d{9})$' THEN
        v_has_owner_contact := true;
    ELSIF coalesce(trim(b.owner_social), '') <> ''
       OR lower(coalesce(b.owner_contact, '')) ~ '(linkedin|http|instagram|facebook|twitter|x\.com)' THEN
        v_has_owner_contact := true;
    END IF;
    IF NOT v_has_owner_contact THEN
        v_problems := array_append(v_problems, 'owner_contact');
    END IF;

    -- 8. Business contact: at least one valid of: email, UK mobile, Instagram, Facebook
    IF coalesce(trim(b.email), '') ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' THEN
        v_has_biz_contact := true;
    ELSIF regexp_replace(coalesce(b.whatsapp_number, ''), '\D', '', 'g') ~ '^(07\d{9}|447\d{9})$' THEN
        v_has_biz_contact := true;
    ELSIF coalesce(trim(b.instagram), '') <> '' THEN
        v_has_biz_contact := true;
    ELSIF coalesce(trim(b.facebook), '') <> '' THEN
        v_has_biz_contact := true;
    END IF;
    IF NOT v_has_biz_contact THEN
        v_problems := array_append(v_problems, 'business_contact');
    END IF;

    -- 9. Tech partner: type Agency or DIY with a name, or None
    IF b.tech_partner_type = 'None' THEN
        v_has_tech_partner := true;
    ELSIF b.tech_partner_type IN ('Agency', 'DIY') AND coalesce(trim(b.tech_partner_name), '') <> '' THEN
        v_has_tech_partner := true;
    ELSIF b.tech_partner_type IS NULL AND coalesce(trim(b.existing_tech_partner), '') <> '' THEN
        IF lower(trim(b.existing_tech_partner)) = 'none' THEN
            v_has_tech_partner := true;
        ELSIF b.existing_tech_partner ~* '^(Agency|DIY)' AND length(trim(b.existing_tech_partner)) > 4 THEN
            v_has_tech_partner := true;
        END IF;
    END IF;
    IF NOT v_has_tech_partner THEN
        v_problems := array_append(v_problems, 'tech_partner');
    END IF;

    -- 10. Gaps found: not empty
    IF coalesce(trim(b.gaps_found), '') = '' THEN
        v_problems := array_append(v_problems, 'gaps');
    END IF;

    RETURN v_problems;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

CREATE OR REPLACE FUNCTION "sales-pipe".lead_problems(p_business_id uuid)
RETURNS text[] AS $$
DECLARE
    b "sales-pipe".businesses;
BEGIN
    SELECT * INTO b FROM "sales-pipe".businesses WHERE id = p_business_id;
    IF b.id IS NULL THEN RETURN '{}'::text[]; END IF;
    RETURN "sales-pipe".compute_business_problems(b);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

-- ------------------------------------------------------------------------------
-- 5. Triggers to maintain problems automatically
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".trg_businesses_compute_problems()
RETURNS trigger AS $$
BEGIN
    NEW.problems := "sales-pipe".compute_business_problems(NEW);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

DROP TRIGGER IF EXISTS trg_businesses_compute_problems ON "sales-pipe".businesses;
CREATE TRIGGER trg_businesses_compute_problems
    BEFORE INSERT OR UPDATE ON "sales-pipe".businesses
    FOR EACH ROW EXECUTE FUNCTION "sales-pipe".trg_businesses_compute_problems();

CREATE OR REPLACE FUNCTION "sales-pipe".trg_opp_services_recompute_problems()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.services_pitched IS NOT DISTINCT FROM NEW.services_pitched THEN
        RETURN NEW;
    END IF;
    UPDATE "sales-pipe".businesses
    SET problems = "sales-pipe".lead_problems(NEW.business_id)
    WHERE id = NEW.business_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

DROP TRIGGER IF EXISTS trg_opp_services_recompute_problems ON "sales-pipe".opportunities;
CREATE TRIGGER trg_opp_services_recompute_problems
    AFTER INSERT OR UPDATE OF services_pitched ON "sales-pipe".opportunities
    FOR EACH ROW EXECUTE FUNCTION "sales-pipe".trg_opp_services_recompute_problems();

-- Initial computation for existing rows
UPDATE "sales-pipe".businesses b
SET problems = "sales-pipe".compute_business_problems(b);

-- ------------------------------------------------------------------------------
-- 6. approve_import: refuse any lead with problems
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".approve_import(p_business_ids uuid[])
RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

CREATE OR REPLACE FUNCTION "sales-pipe".add_pitch(p_business_id uuid, p_services text[], p_demo_link text DEFAULT NULL)
RETURNS uuid AS $$
DECLARE v_id uuid;
BEGIN
    INSERT INTO "sales-pipe".opportunities (business_id, services_pitched, stage, demo_link)
    VALUES (p_business_id, p_services, 'Needs review', p_demo_link)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

REVOKE ALL ON FUNCTION "sales-pipe".add_pitch(uuid, text[], text) FROM anon, public;
GRANT EXECUTE ON FUNCTION "sales-pipe".add_pitch(uuid, text[], text) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. import_businesses: accepts p_batch_id, saves ALL rows with a business name
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS "sales-pipe".import_businesses(jsonb);
DROP FUNCTION IF EXISTS "sales-pipe".import_businesses(jsonb, uuid);
CREATE OR REPLACE FUNCTION "sales-pipe".import_businesses(p_rows jsonb, p_batch_id uuid DEFAULT NULL)
RETURNS jsonb AS $$
DECLARE
    x jsonb;
    v_action text;
    v_bid uuid;
    v_services text[];
    v_type text;
    v_created int := 0; v_updated int := 0; v_pitches int := 0; v_skipped int := 0; v_failed int := 0;
    v_ready int := 0; v_missing int := 0;
    v_errors jsonb := '[]'::jsonb;
    v_idx int;
    v_name text;
    v_tech_type text;
    v_tech_name text;
    v_branches jsonb;
    v_raw_branches text;
    v_probs text[];
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales']);

    IF jsonb_array_length(p_rows) > 2000 THEN
        RAISE EXCEPTION 'Send at most 2,000 rows at a time';
    END IF;

    FOR x IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
        v_idx := coalesce((x->>'idx')::int, v_created + v_updated + v_pitches + v_skipped + v_failed);
        v_action := coalesce(x->>'action', 'new');
        BEGIN
            IF v_action = 'skip' THEN
                v_skipped := v_skipped + 1;
                CONTINUE;
            END IF;

            v_name := trim(coalesce(x->>'business_name', ''));
            IF v_name = '' THEN
                RAISE EXCEPTION 'Business name is required';
            END IF;

            SELECT coalesce(array_agg(DISTINCT trim(s)) FILTER (WHERE trim(s) <> ''), '{}')
              INTO v_services
              FROM jsonb_array_elements_text(coalesce(x->'services', '[]'::jsonb)) s;
            -- Filter to valid services only
            SELECT coalesce(array_agg(s), '{}') INTO v_services
              FROM unnest(v_services) s
              WHERE s = ANY("sales-pipe".valid_services());

            v_type := nullif(trim(x->>'business_type'), '');
            IF v_type IS NOT NULL AND v_type NOT IN ('Hotel', 'Restaurant or cafe', 'Pub', 'Property management') THEN
                v_type := "sales-pipe".canonical_business_type(v_type);
            END IF;

            -- Tech partner parsing
            v_tech_type := nullif(trim(x->>'tech_partner_type'), '');
            IF v_tech_type IS NULL AND nullif(trim(x->>'existing_tech_partner'), '') IS NOT NULL THEN
                IF lower(trim(x->>'existing_tech_partner')) = 'none' THEN
                    v_tech_type := 'None';
                ELSIF trim(x->>'existing_tech_partner') ~* '^Agency' THEN
                    v_tech_type := 'Agency';
                    v_tech_name := trim(regexp_replace(x->>'existing_tech_partner', '^(?i)Agency\s*\(?|\)?$', '', 'g'));
                ELSIF trim(x->>'existing_tech_partner') ~* '^DIY' THEN
                    v_tech_type := 'DIY';
                    v_tech_name := trim(regexp_replace(x->>'existing_tech_partner', '^(?i)DIY\s*\(?|\)?$', '', 'g'));
                END IF;
            END IF;
            IF v_tech_type IS NOT NULL AND v_tech_type NOT IN ('Agency', 'DIY', 'None') THEN
                v_tech_type := NULL;
            END IF;
            IF v_tech_name IS NULL THEN
                v_tech_name := nullif(trim(x->>'tech_partner_name'), '');
            END IF;

            -- Branches parsing (either jsonb array or parsed from string)
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
                    existing_website, company_type, contact_name, notes, owner_contact, existing_tech_partner, gaps_found, has_no_website,
                    owner_email, owner_whatsapp, owner_social, tech_partner_type, tech_partner_name, branches, source, import_batch_id)
                VALUES (
                    v_name, v_type, "sales-pipe".type_category(v_type),
                    nullif(x->>'tier', ''), nullif(x->>'room_count', '')::int,
                    nullif(trim(x->>'area'), ''), nullif(trim(x->>'address'), ''), upper(nullif(trim(x->>'postcode'), '')),
                    nullif(trim(x->>'maps_link'), ''),
                    nullif(x->>'google_rating', '')::numeric, nullif(regexp_replace(coalesce(x->>'google_reviews_count', ''), '\D', '', 'g'), '')::int,
                    nullif(trim(x->>'whatsapp_number'), ''),
                    nullif(lower(trim(x->>'email')), ''),
                    "sales-pipe".clean_handle(x->>'instagram'), "sales-pipe".clean_handle(x->>'facebook'), nullif(trim(x->>'linkedin'), ''),
                    nullif(trim(x->>'existing_website'), ''),
                    coalesce(nullif(x->>'company_type', ''), 'Unknown'),
                    nullif(trim(x->>'contact_name'), ''), nullif(trim(x->>'notes'), ''),
                    nullif(trim(x->>'owner_contact'), ''), nullif(trim(x->>'existing_tech_partner'), ''),
                    nullif(trim(x->>'gaps_found'), ''),
                    coalesce((x->>'has_no_website')::boolean, (lower(trim(coalesce(x->>'no_site', ''))) IN ('true', 'yes', '1', 't'))),
                    nullif(lower(trim(x->>'owner_email')), ''), nullif(trim(x->>'owner_whatsapp'), ''), nullif(trim(x->>'owner_social'), ''),
                    v_tech_type, v_tech_name, coalesce(v_branches, '[]'::jsonb), nullif(trim(x->>'source'), ''), p_batch_id)
                RETURNING id INTO v_bid;

                PERFORM "sales-pipe".add_pitch(v_bid, v_services, nullif(trim(x->>'demo_link'), ''));

                -- Recompute problems with the opportunity linked
                UPDATE "sales-pipe".businesses SET problems = "sales-pipe".lead_problems(v_bid) WHERE id = v_bid RETURNING problems INTO v_probs;
                IF array_length(v_probs, 1) IS NULL THEN
                    v_ready := v_ready + 1;
                ELSE
                    v_missing := v_missing + 1;
                END IF;
                v_created := v_created + 1;

            ELSIF v_action IN ('update', 'new_pitch') THEN
                v_bid := nullif(x->>'existing_id', '')::uuid;
                IF v_bid IS NULL OR NOT EXISTS (SELECT 1 FROM "sales-pipe".businesses WHERE id = v_bid) THEN
                    RAISE EXCEPTION 'The existing business was not found';
                END IF;

                IF v_action = 'update' THEN
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
                        existing_website = coalesce(nullif(trim(x->>'existing_website'), ''), b.existing_website),
                        company_type = coalesce(nullif(x->>'company_type', ''), b.company_type),
                        contact_name = coalesce(nullif(trim(x->>'contact_name'), ''), b.contact_name),
                        notes = CASE WHEN nullif(trim(x->>'notes'), '') IS NOT NULL THEN concat_ws('; ', b.notes, trim(x->>'notes')) ELSE b.notes END,
                        owner_contact = coalesce(nullif(trim(x->>'owner_contact'), ''), b.owner_contact),
                        owner_email = coalesce(nullif(lower(trim(x->>'owner_email')), ''), b.owner_email),
                        owner_whatsapp = coalesce(nullif(trim(x->>'owner_whatsapp'), ''), b.owner_whatsapp),
                        owner_social = coalesce(nullif(trim(x->>'owner_social'), ''), b.owner_social),
                        tech_partner_type = coalesce(v_tech_type, b.tech_partner_type),
                        tech_partner_name = coalesce(v_tech_name, b.tech_partner_name),
                        branches = CASE WHEN v_branches IS NOT NULL AND jsonb_array_length(v_branches) > 0 THEN v_branches ELSE b.branches END,
                        source = coalesce(nullif(trim(x->>'source'), ''), b.source),
                        import_batch_id = coalesce(p_batch_id, b.import_batch_id),
                        existing_tech_partner = coalesce(nullif(trim(x->>'existing_tech_partner'), ''), b.existing_tech_partner),
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
                    v_updated := v_updated + 1;
                END IF;

                IF v_action = 'new_pitch' THEN
                    PERFORM "sales-pipe".add_pitch(v_bid, v_services, nullif(trim(x->>'demo_link'), ''));
                    UPDATE "sales-pipe".businesses SET problems = "sales-pipe".lead_problems(v_bid) WHERE id = v_bid RETURNING problems INTO v_probs;
                    IF array_length(v_probs, 1) IS NULL THEN
                        v_ready := v_ready + 1;
                    ELSE
                        v_missing := v_missing + 1;
                    END IF;
                    v_pitches := v_pitches + 1;
                END IF;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            v_failed := v_failed + 1;
            v_errors := v_errors || jsonb_build_object(
                'idx', v_idx,
                'name', coalesce(x->>'business_name', '(row ' || v_idx || ')'),
                'message', SQLERRM);
        END;
    END LOOP;

    -- Update batch metrics if batch id provided
    IF p_batch_id IS NOT NULL THEN
        UPDATE "sales-pipe".import_batches
        SET total_rows = total_rows + v_created + v_updated + v_pitches + v_failed,
            ready_count = ready_count + v_ready,
            missing_count = missing_count + v_missing,
            failed_count = failed_count + v_failed
        WHERE id = p_batch_id;
    END IF;

    RETURN jsonb_build_object(
        'created', v_created,
        'updated', v_updated,
        'pitches', v_pitches,
        'skipped', v_skipped,
        'failed', v_failed,
        'ready', v_ready,
        'missing', v_missing,
        'errors', v_errors);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

REVOKE ALL ON FUNCTION "sales-pipe".import_businesses(jsonb, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION "sales-pipe".import_businesses(jsonb, uuid) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 8. missing_counts(p_type, p_problem, p_batch)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".missing_counts(
    p_type text DEFAULT NULL,
    p_problem text DEFAULT NULL,
    p_batch uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
    v_result jsonb;
BEGIN
    IF v_role IS NULL AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Your account is not set up';
    END IF;

    -- Base missing dataset according to role and active filters
    WITH base AS (
        SELECT b.id, b.business_type, b.problems
        FROM "sales-pipe".businesses b
        JOIN "sales-pipe".opportunities o ON o.business_id = b.id
        WHERE o.stage = 'Needs review'
          AND b.problems <> '{}'::text[]
          AND NOT b.archived
          AND (v_role = 'admin' OR auth.role() = 'service_role'
               OR o.assigned_sales_id = v_uid
               OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

REVOKE ALL ON FUNCTION "sales-pipe".missing_counts(text, text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION "sales-pipe".missing_counts(text, text, uuid) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 9. missing_list(p_type, p_problem, p_batch, p_limit, p_offset)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".missing_list(
    p_type text DEFAULT NULL,
    p_problem text DEFAULT NULL,
    p_batch uuid DEFAULT NULL,
    p_limit int DEFAULT 50,
    p_offset int DEFAULT 0
)
RETURNS TABLE (
    opportunity_id uuid,
    business_id uuid,
    business_name text,
    business_type text,
    existing_website text,
    has_no_website boolean,
    address text,
    postcode text,
    branches jsonb,
    services text[],
    contact_name text,
    owner_email text,
    owner_whatsapp text,
    owner_social text,
    owner_contact text,
    email text,
    whatsapp_number text,
    instagram text,
    facebook text,
    linkedin text,
    tech_partner_type text,
    tech_partner_name text,
    existing_tech_partner text,
    gaps_found text,
    source text,
    import_batch_id uuid,
    batch_file_name text,
    batch_uploaded_at timestamptz,
    problems text[],
    total_count bigint
) AS $$
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
            b.owner_whatsapp AS r_owner_whatsapp,
            b.owner_social AS r_owner_social,
            b.owner_contact AS r_owner_contact,
            b.email AS r_email,
            b.whatsapp_number AS r_whatsapp_number,
            b.instagram AS r_instagram,
            b.facebook AS r_facebook,
            b.linkedin AS r_linkedin,
            b.tech_partner_type AS r_tech_partner_type,
            b.tech_partner_name AS r_tech_partner_name,
            b.existing_tech_partner AS r_existing_tech_partner,
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
               OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
          AND (nullif(p_type, '') IS NULL OR b.business_type = p_type)
          AND (nullif(p_problem, '') IS NULL OR p_problem = ANY(b.problems))
          AND (p_batch IS NULL OR b.import_batch_id = p_batch)
    )
    SELECT
        r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type,
        r.r_existing_website, r.r_has_no_website, r.r_address, r.r_postcode,
        r.r_branches, r.r_services, r.r_contact_name, r.r_owner_email,
        r.r_owner_whatsapp, r.r_owner_social, r.r_owner_contact,
        r.r_email, r.r_whatsapp_number, r.r_instagram, r.r_facebook, r.r_linkedin,
        r.r_tech_partner_type, r.r_tech_partner_name, r.r_existing_tech_partner,
        r.r_gaps_found, r.r_source, r.r_import_batch_id, r.r_batch_file_name,
        r.r_batch_uploaded_at, r.r_problems,
        count(*) OVER () AS total_count
    FROM rows r
    ORDER BY lower(coalesce(r.r_business_name, '')), r.r_business_id
    LIMIT least(coalesce(p_limit, 50), 200) OFFSET greatest(coalesce(p_offset, 0), 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

REVOKE ALL ON FUNCTION "sales-pipe".missing_list(text, text, uuid, int, int) FROM anon, public;
GRANT EXECUTE ON FUNCTION "sales-pipe".missing_list(text, text, uuid, int, int) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 10. update_lead_field(p_business_id, p_field, p_value)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".update_lead_field(
    p_business_id uuid,
    p_field text,
    p_value text
)
RETURNS jsonb AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
    v_field text := lower(trim(p_field));
    v_val text := trim(coalesce(p_value, ''));
    v_clean_val text := nullif(v_val, '');
    v_services text[];
    v_new_problems text[];
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
               OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
    ) THEN
        RAISE EXCEPTION 'You cannot edit this business';
    END IF;

    -- Whitelisted fields
    IF v_field IN ('business_name', 'name') THEN
        UPDATE "sales-pipe".businesses SET business_name = coalesce(v_clean_val, '') WHERE id = p_business_id;
    ELSIF v_field IN ('business_type', 'category') THEN
        IF v_clean_val NOT IN ('Hotel', 'Restaurant or cafe', 'Pub', 'Property management') THEN
            v_clean_val := "sales-pipe".canonical_business_type(v_clean_val);
        END IF;
        IF v_clean_val IS NULL THEN RAISE EXCEPTION 'Invalid category'; END IF;
        UPDATE "sales-pipe".businesses
        SET business_type = v_clean_val, category = "sales-pipe".type_category(v_clean_val)
        WHERE id = p_business_id;
    ELSIF v_field IN ('website', 'existing_website') THEN
        IF v_clean_val IS NOT NULL AND v_clean_val !~* '^https?://' THEN
            v_clean_val := 'https://' || v_clean_val;
        END IF;
        UPDATE "sales-pipe".businesses SET existing_website = v_clean_val, has_no_website = false WHERE id = p_business_id;
    ELSIF v_field IN ('has_no_website', 'no_site') THEN
        IF lower(v_val) IN ('true', 'yes', '1', 't') THEN
            UPDATE "sales-pipe".businesses SET has_no_website = true, existing_website = NULL WHERE id = p_business_id;
        ELSE
            UPDATE "sales-pipe".businesses SET has_no_website = false WHERE id = p_business_id;
        END IF;
    ELSIF v_field = 'address' THEN
        UPDATE "sales-pipe".businesses SET address = v_clean_val WHERE id = p_business_id;
    ELSIF v_field = 'postcode' THEN
        UPDATE "sales-pipe".businesses SET postcode = upper(v_clean_val) WHERE id = p_business_id;
    ELSIF v_field = 'branches' THEN
        UPDATE "sales-pipe".businesses SET branches = coalesce(v_val::jsonb, '[]'::jsonb) WHERE id = p_business_id;
    ELSIF v_field IN ('services', 'service', 'services_pitched') THEN
        SELECT coalesce(array_agg(DISTINCT trim(s)) FILTER (WHERE trim(s) <> ''), '{}')
          INTO v_services
          FROM unnest(string_to_array(replace(v_val, ';', ','), ',')) s;
        SELECT coalesce(array_agg(s), '{}') INTO v_services
          FROM unnest(v_services) s
          WHERE s = ANY("sales-pipe".valid_services());
        UPDATE "sales-pipe".opportunities SET services_pitched = v_services
        WHERE business_id = p_business_id AND stage = 'Needs review';
    ELSIF v_field IN ('contact_name', 'owner_name') THEN
        UPDATE "sales-pipe".businesses SET contact_name = v_clean_val WHERE id = p_business_id;
    ELSIF v_field = 'owner_email' THEN
        UPDATE "sales-pipe".businesses SET owner_email = lower(v_clean_val) WHERE id = p_business_id;
    ELSIF v_field = 'owner_whatsapp' THEN
        UPDATE "sales-pipe".businesses SET owner_whatsapp = v_clean_val WHERE id = p_business_id;
    ELSIF v_field = 'owner_social' THEN
        UPDATE "sales-pipe".businesses SET owner_social = v_clean_val WHERE id = p_business_id;
    ELSIF v_field = 'owner_contact' THEN
        UPDATE "sales-pipe".businesses SET owner_contact = v_clean_val WHERE id = p_business_id;
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
    ELSIF v_field = 'tech_partner_name' THEN
        UPDATE "sales-pipe".businesses SET tech_partner_name = v_clean_val WHERE id = p_business_id;
    ELSIF v_field = 'existing_tech_partner' THEN
        UPDATE "sales-pipe".businesses SET existing_tech_partner = v_clean_val WHERE id = p_business_id;
    ELSIF v_field = 'gaps_found' THEN
        UPDATE "sales-pipe".businesses SET gaps_found = v_clean_val WHERE id = p_business_id;
    ELSIF v_field = 'source' THEN
        UPDATE "sales-pipe".businesses SET source = v_clean_val WHERE id = p_business_id;
    ELSE
        RAISE EXCEPTION 'Field % cannot be updated directly', p_field;
    END IF;

    -- Recompute problems
    UPDATE "sales-pipe".businesses
    SET problems = "sales-pipe".lead_problems(p_business_id)
    WHERE id = p_business_id
    RETURNING problems INTO v_new_problems;

    RETURN jsonb_build_object(
        'ok', true,
        'business_id', p_business_id,
        'problems', coalesce(v_new_problems, '{}'::text[]),
        'ready', array_length(v_new_problems, 1) IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

REVOKE ALL ON FUNCTION "sales-pipe".update_lead_field(uuid, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION "sales-pipe".update_lead_field(uuid, text, text) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 11. bulk_set_field(p_business_ids, p_field, p_value)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".bulk_set_field(
    p_business_ids uuid[],
    p_field text,
    p_value text
)
RETURNS int AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
    v_field text := lower(trim(p_field));
    v_val text := trim(coalesce(p_value, ''));
    v_services text[];
    v_count int := 0;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales']);

    IF v_field IN ('category', 'business_type') THEN
        IF v_val NOT IN ('Hotel', 'Restaurant or cafe', 'Pub', 'Property management') THEN
            v_val := "sales-pipe".canonical_business_type(v_val);
        END IF;
        IF v_val IS NULL THEN RAISE EXCEPTION 'Invalid category: %', p_value; END IF;

        UPDATE "sales-pipe".businesses
        SET business_type = v_val, category = "sales-pipe".type_category(v_val)
        WHERE id = ANY(p_business_ids)
          AND (v_role = 'admin' OR EXISTS (
              SELECT 1 FROM "sales-pipe".opportunities o WHERE o.business_id = businesses.id AND (o.assigned_sales_id = v_uid OR o.assigned_sales_id IS NULL)
          ));
        GET DIAGNOSTICS v_count = ROW_COUNT;

    ELSIF v_field IN ('service', 'services') THEN
        SELECT coalesce(array_agg(DISTINCT trim(s)) FILTER (WHERE trim(s) <> ''), '{}')
          INTO v_services
          FROM unnest(string_to_array(replace(v_val, ';', ','), ',')) s;
        SELECT coalesce(array_agg(s), '{}') INTO v_services
          FROM unnest(v_services) s
          WHERE s = ANY("sales-pipe".valid_services());
        IF array_length(v_services, 1) IS NULL THEN
            RAISE EXCEPTION 'Pick at least one valid service';
        END IF;

        UPDATE "sales-pipe".opportunities
        SET services_pitched = v_services
        WHERE business_id = ANY(p_business_ids) AND stage = 'Needs review'
          AND (v_role = 'admin' OR assigned_sales_id = v_uid OR assigned_sales_id IS NULL);
        GET DIAGNOSTICS v_count = ROW_COUNT;

    ELSIF v_field = 'tech_partner_type' THEN
        IF v_val NOT IN ('Agency', 'DIY', 'None') THEN
            RAISE EXCEPTION 'Tech partner type must be Agency, DIY, or None';
        END IF;

        UPDATE "sales-pipe".businesses
        SET tech_partner_type = v_val,
            tech_partner_name = CASE WHEN v_val = 'None' THEN NULL ELSE tech_partner_name END
        WHERE id = ANY(p_business_ids)
          AND (v_role = 'admin' OR EXISTS (
              SELECT 1 FROM "sales-pipe".opportunities o WHERE o.business_id = businesses.id AND (o.assigned_sales_id = v_uid OR o.assigned_sales_id IS NULL)
          ));
        GET DIAGNOSTICS v_count = ROW_COUNT;

    ELSE
        RAISE EXCEPTION 'Bulk set is only supported for category, service, and tech_partner_type';
    END IF;

    -- Recompute problems on all affected businesses
    UPDATE "sales-pipe".businesses b
    SET problems = "sales-pipe".lead_problems(b.id)
    WHERE b.id = ANY(p_business_ids);

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

REVOKE ALL ON FUNCTION "sales-pipe".bulk_set_field(uuid[], text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION "sales-pipe".bulk_set_field(uuid[], text, text) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 12. delete_leads(p_business_ids uuid[])
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".delete_leads(p_business_ids uuid[])
RETURNS int AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
    v_count int := 0;
    v_bid uuid;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales']);

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
              OR (v_role = 'sales' AND o.assigned_sales_id IS NULL)
          )
    LOOP
        DELETE FROM "sales-pipe".businesses WHERE id = v_bid;
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

REVOKE ALL ON FUNCTION "sales-pipe".delete_leads(uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION "sales-pipe".delete_leads(uuid[]) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 13. list_import_batches()
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".list_import_batches()
RETURNS TABLE (
    id uuid,
    file_name text,
    uploaded_by uuid,
    uploader_name text,
    created_at timestamptz,
    total_rows int,
    ready_count int,
    missing_count int,
    failed_count int
) AS $$
DECLARE
    v_role text := "sales-pipe".get_user_role();
BEGIN
    IF v_role IS NULL AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Your account is not set up';
    END IF;

    RETURN QUERY
    SELECT
        ib.id,
        ib.file_name,
        ib.uploaded_by,
        coalesce(p.full_name, 'Staff') AS uploader_name,
        ib.created_at,
        ib.total_rows,
        ib.ready_count,
        ib.missing_count,
        ib.failed_count
    FROM "sales-pipe".import_batches ib
    LEFT JOIN "sales-pipe".profiles p ON p.id = ib.uploaded_by
    ORDER BY ib.created_at DESC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

REVOKE ALL ON FUNCTION "sales-pipe".list_import_batches() FROM anon, public;
GRANT EXECUTE ON FUNCTION "sales-pipe".list_import_batches() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION "sales-pipe".create_import_batch(p_file_name text)
RETURNS uuid AS $$
DECLARE
    v_id uuid;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales']);
    INSERT INTO "sales-pipe".import_batches (file_name, uploaded_by)
    VALUES (coalesce(nullif(trim(p_file_name), ''), 'leads.csv'), auth.uid())
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

REVOKE ALL ON FUNCTION "sales-pipe".create_import_batch(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION "sales-pipe".create_import_batch(text) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 14. Update list_pitches: Approval queue only returns problems = '{}'
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS "sales-pipe".list_pitches(text, text, text, text, text, text, boolean, int, int);
CREATE OR REPLACE FUNCTION "sales-pipe".list_pitches(
    p_service text DEFAULT NULL,
    p_type text DEFAULT NULL,
    p_filter text DEFAULT 'all',
    p_search text DEFAULT NULL,
    p_platform text DEFAULT NULL,
    p_assigned text DEFAULT NULL,
    p_include_archived boolean DEFAULT false,
    p_limit int DEFAULT 24,
    p_offset int DEFAULT 0
)
RETURNS TABLE (
    opportunity_id uuid,
    business_id uuid,
    business_name text,
    business_type text,
    area text,
    postcode text,
    address text,
    google_rating numeric,
    phone text,
    email text,
    instagram text,
    facebook text,
    company_type text,
    contact_name text,
    archived boolean,
    stage text,
    services_pitched text[],
    services_won text[],
    assigned_sales_id uuid,
    assigned_sales_name text,
    assigned_consultant_name text,
    consultation_at timestamptz,
    created_at timestamptz,
    threads jsonb,
    next_due_on date,
    needs_reply boolean,
    total_count bigint
) AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
BEGIN
    IF v_role IS NULL AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Your account is not set up';
    END IF;

    RETURN QUERY
    WITH base AS (
        SELECT o.*, b.business_name AS b_name, b.business_type AS b_type, b.area AS b_area, b.postcode AS b_pc,
               b.address AS b_address, b.google_rating AS b_rating,
               coalesce(b.whatsapp_number, b.phone) AS b_phone,
               b.email AS b_email,
               b.instagram AS b_ig, b.facebook AS b_fb, b.company_type AS b_ct, b.contact_name AS b_contact,
               b.archived AS b_archived,
               EXISTS (SELECT 1 FROM "sales-pipe".threads t
                        WHERE t.opportunity_id = o.id AND t.status = 'Replied'
                          AND t.last_inbound_at > coalesce(t.last_outbound_at, '-infinity'))
               AND o.stage IN ('Active', 'Interested', 'Consultation') AS b_needs_reply
        FROM "sales-pipe".opportunities o
        JOIN "sales-pipe".businesses b ON b.id = o.business_id
        WHERE (p_include_archived OR NOT b.archived)
          AND (v_role = 'admin' OR auth.role() = 'service_role'
               OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
               OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
          AND (nullif(p_service, '') IS NULL OR p_service = ANY(o.services_pitched))
          AND (nullif(p_type, '') IS NULL OR b.business_type = p_type)
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
           count(*) OVER ()
    FROM filtered f
    ORDER BY
        CASE WHEN p_filter = 'Needs review' THEN f.created_at END DESC,
        f.b_needs_reply DESC,
        (SELECT min(t.next_due_on) FROM "sales-pipe".threads t WHERE t.opportunity_id = f.id) ASC NULLS LAST,
        f.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

REVOKE ALL ON FUNCTION "sales-pipe".list_pitches(text, text, text, text, text, text, boolean, int, int) FROM anon, public;
GRANT EXECUTE ON FUNCTION "sales-pipe".list_pitches(text, text, text, text, text, text, boolean, int, int) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 15. Update v_dashboard_status_counts: needs_review only counts ready leads
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS "sales-pipe".v_dashboard_status_counts(uuid);
CREATE OR REPLACE FUNCTION "sales-pipe".v_dashboard_status_counts(p_user uuid)
RETURNS TABLE (
    needs_reply bigint, interested bigint, consultation bigint, went_cold bigint, no_response bigint,
    needs_consultant bigint, unmatched_bookings bigint, needs_review bigint, total_pitches bigint
) AS $$
DECLARE
    v_role text;
BEGIN
    IF auth.role() <> 'service_role' AND p_user IS DISTINCT FROM auth.uid()
       AND coalesce("sales-pipe".get_user_role(), '') <> 'admin' THEN
        RAISE EXCEPTION 'You can only see your own numbers';
    END IF;
    SELECT role INTO v_role FROM "sales-pipe".profiles WHERE id = p_user;

    RETURN QUERY
    WITH mine AS (
        SELECT o.*, b.problems FROM "sales-pipe".opportunities o
        JOIN "sales-pipe".businesses b ON b.id = o.business_id AND NOT b.archived
        WHERE v_role = 'admin' OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user
           OR (v_role = 'sales' AND o.stage = 'Needs review' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
    )
    SELECT
        (SELECT count(DISTINCT m.id) FROM mine m JOIN "sales-pipe".threads t ON t.opportunity_id = m.id
          WHERE m.stage IN ('Active', 'Interested', 'Consultation') AND t.status = 'Replied'
            AND t.last_inbound_at > coalesce(t.last_outbound_at, '-infinity')),
        (SELECT count(*) FROM mine WHERE stage = 'Interested'),
        (SELECT count(*) FROM mine WHERE stage = 'Consultation'),
        (SELECT count(*) FROM mine WHERE stage = 'Went cold'),
        (SELECT count(*) FROM mine WHERE stage = 'No response'),
        (CASE WHEN v_role = 'admin' THEN (SELECT count(*) FROM mine WHERE stage = 'Consultation' AND assigned_consultant_id IS NULL) ELSE 0 END),
        (CASE WHEN v_role = 'admin' THEN (SELECT count(*) FROM "sales-pipe".consultation_bookings WHERE match_status = 'unmatched') ELSE 0 END),
        (SELECT count(*) FROM mine WHERE stage = 'Needs review' AND problems = '{}'::text[]),
        (SELECT count(*) FROM mine);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

NOTIFY pgrst, 'reload schema';
