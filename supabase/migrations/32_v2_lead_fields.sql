-- ==============================================================================
-- 32_v2_lead_fields.sql
-- Add optional lead fields and enforce the 4 required checks:
-- 1. Business name
-- 2. Category (Hotel, Restaurant or cafe, Pub, Property management)
-- 3. Service to pitch
-- 4. At least one contact (email, WhatsApp, Instagram, or Facebook)
-- ==============================================================================

SET search_path TO "sales-pipe", public;

ALTER TABLE "sales-pipe".businesses
  ADD COLUMN IF NOT EXISTS owner_contact text,
  ADD COLUMN IF NOT EXISTS existing_tech_partner text,
  ADD COLUMN IF NOT EXISTS gaps_found text,
  ADD COLUMN IF NOT EXISTS has_no_website boolean DEFAULT false;

CREATE OR REPLACE FUNCTION "sales-pipe".type_category(p_type text)
RETURNS text AS $$
    SELECT CASE
        WHEN p_type IN ('Hotel', 'Hotels', 'Boutique hotel', 'B&B / Guesthouse', 'Hostel') THEN 'Accommodation'
        WHEN p_type IN ('Restaurant or cafe', 'Restaurants and cafes', 'Restaurant', 'Cafe', 'Bakery', 'Takeaway') THEN 'Food & Drink'
        WHEN p_type IN ('Pub', 'Pubs', 'Pub / Bar', 'Bar') THEN 'Food & Drink'
        WHEN p_type IN ('Property management', 'Property Management', 'Short-let / Airbnb host', 'Serviced apartments') THEN 'Accommodation'
        WHEN p_type IN ('Hair salon', 'Barber', 'Beauty', 'Nails & Lashes', 'Medical aesthetics', 'Spa', 'Fitness / Training studio') THEN 'Beauty & Wellness'
        WHEN p_type IN ('Fashion boutique', 'Florist', 'Other') THEN 'Retail & Other'
        ELSE p_type END
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION "sales-pipe".import_businesses(p_rows jsonb)
RETURNS jsonb AS $$
DECLARE
    x jsonb;
    v_action text;
    v_bid uuid;
    v_services text[];
    v_type text;
    v_created int := 0; v_updated int := 0; v_pitches int := 0; v_skipped int := 0; v_failed int := 0;
    v_errors jsonb := '[]'::jsonb;
    v_idx int;
    v_has_contact boolean;
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

            SELECT coalesce(array_agg(DISTINCT trim(s)) FILTER (WHERE trim(s) <> ''), '{}')
              INTO v_services
              FROM jsonb_array_elements_text(coalesce(x->'services', '[]'::jsonb)) s;
            IF array_length(v_services, 1) IS NULL AND v_action IN ('new', 'new_pitch') THEN
                RAISE EXCEPTION 'Pick at least one service to pitch';
            END IF;
            IF NOT (v_services <@ "sales-pipe".valid_services()) THEN
                RAISE EXCEPTION 'Unknown service: %', array_to_string(v_services, ', ');
            END IF;

            v_type := nullif(trim(x->>'business_type'), '');
            IF v_type IS NOT NULL AND "sales-pipe".type_category(v_type) IS NULL THEN
                RAISE EXCEPTION 'Unknown category: %', v_type;
            END IF;

            -- At least one contact required: email, whatsapp_number, phone, instagram, or facebook
            v_has_contact := nullif(trim(x->>'email'), '') IS NOT NULL
                          OR nullif(trim(x->>'whatsapp_number'), '') IS NOT NULL
                          OR nullif(trim(x->>'phone'), '') IS NOT NULL
                          OR nullif(trim(x->>'instagram'), '') IS NOT NULL
                          OR nullif(trim(x->>'facebook'), '') IS NOT NULL;

            IF v_action = 'new' THEN
                IF coalesce(trim(x->>'business_name'), '') = '' THEN RAISE EXCEPTION 'Business name is missing'; END IF;
                IF v_type IS NULL THEN RAISE EXCEPTION 'Category is missing'; END IF;
                IF NOT v_has_contact THEN RAISE EXCEPTION 'At least one contact is required (email, WhatsApp, Instagram, or Facebook)'; END IF;

                INSERT INTO "sales-pipe".businesses (
                    business_name, business_type, category, tier, room_count, area, address, postcode, maps_link,
                    google_rating, google_reviews_count, phone, whatsapp_number, email, instagram, facebook,
                    existing_website, company_type, contact_name, notes, owner_contact, existing_tech_partner, gaps_found, has_no_website)
                VALUES (
                    trim(x->>'business_name'), v_type, "sales-pipe".type_category(v_type),
                    nullif(x->>'tier', ''), nullif(x->>'room_count', '')::int,
                    nullif(trim(x->>'area'), ''), nullif(trim(x->>'address'), ''), upper(nullif(trim(x->>'postcode'), '')),
                    nullif(trim(x->>'maps_link'), ''),
                    nullif(x->>'google_rating', '')::numeric, nullif(regexp_replace(coalesce(x->>'google_reviews_count', ''), '\\D', '', 'g'), '')::int,
                    nullif(trim(x->>'phone'), ''), nullif(trim(x->>'whatsapp_number'), ''),
                    nullif(lower(trim(x->>'email')), ''),
                    "sales-pipe".clean_handle(x->>'instagram'), "sales-pipe".clean_handle(x->>'facebook'),
                    nullif(trim(x->>'existing_website'), ''),
                    coalesce(nullif(x->>'company_type', ''), 'Unknown'),
                    nullif(trim(x->>'contact_name'), ''), nullif(trim(x->>'notes'), ''),
                    nullif(trim(x->>'owner_contact'), ''), nullif(trim(x->>'existing_tech_partner'), ''),
                    nullif(trim(x->>'gaps_found'), ''),
                    coalesce((x->>'has_no_website')::boolean, false))
                RETURNING id INTO v_bid;
                v_created := v_created + 1;

            ELSIF v_action IN ('update', 'new_pitch') THEN
                v_bid := nullif(x->>'existing_id', '')::uuid;
                IF v_bid IS NULL OR NOT EXISTS (SELECT 1 FROM "sales-pipe".businesses WHERE id = v_bid) THEN
                    RAISE EXCEPTION 'The existing business was not found';
                END IF;
                IF v_action = 'update' THEN
                    UPDATE "sales-pipe".businesses b SET
                        business_type = coalesce(v_type, b.business_type),
                        category = coalesce("sales-pipe".type_category(v_type), b.category),
                        tier = coalesce(nullif(x->>'tier', ''), b.tier),
                        room_count = coalesce(nullif(x->>'room_count', '')::int, b.room_count),
                        area = coalesce(nullif(trim(x->>'area'), ''), b.area),
                        address = coalesce(nullif(trim(x->>'address'), ''), b.address),
                        postcode = coalesce(upper(nullif(trim(x->>'postcode'), '')), b.postcode),
                        maps_link = coalesce(nullif(trim(x->>'maps_link'), ''), b.maps_link),
                        google_rating = coalesce(nullif(x->>'google_rating', '')::numeric, b.google_rating),
                        google_reviews_count = coalesce(nullif(regexp_replace(coalesce(x->>'google_reviews_count', ''), '\\D', '', 'g'), '')::int, b.google_reviews_count),
                        phone = coalesce(nullif(trim(x->>'phone'), ''), b.phone),
                        whatsapp_number = coalesce(nullif(trim(x->>'whatsapp_number'), ''), b.whatsapp_number),
                        email = coalesce(nullif(lower(trim(x->>'email')), ''), b.email),
                        instagram = coalesce("sales-pipe".clean_handle(x->>'instagram'), b.instagram),
                        facebook = coalesce("sales-pipe".clean_handle(x->>'facebook'), b.facebook),
                        existing_website = coalesce(nullif(trim(x->>'existing_website'), ''), b.existing_website),
                        company_type = coalesce(nullif(x->>'company_type', ''), b.company_type),
                        contact_name = coalesce(nullif(trim(x->>'contact_name'), ''), b.contact_name),
                        notes = CASE WHEN nullif(trim(x->>'notes'), '') IS NOT NULL THEN concat_ws('; ', b.notes, trim(x->>'notes')) ELSE b.notes END,
                        owner_contact = coalesce(nullif(trim(x->>'owner_contact'), ''), b.owner_contact),
                        existing_tech_partner = coalesce(nullif(trim(x->>'existing_tech_partner'), ''), b.existing_tech_partner),
                        gaps_found = coalesce(nullif(trim(x->>'gaps_found'), ''), b.gaps_found),
                        has_no_website = coalesce((x->>'has_no_website')::boolean, b.has_no_website)
                    WHERE b.id = v_bid;
                    v_updated := v_updated + 1;
                END IF;
            END IF;

            IF v_action IN ('new', 'new_pitch') THEN
                PERFORM "sales-pipe".add_pitch(v_bid, v_services, nullif(trim(x->>'demo_link'), ''));
                IF v_action = 'new_pitch' THEN v_pitches := v_pitches + 1; END IF;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            v_failed := v_failed + 1;
            v_errors := v_errors || jsonb_build_object(
                'idx', v_idx,
                'name', coalesce(x->>'business_name', '(row ' || v_idx || ')'),
                'message', SQLERRM);
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'created', v_created,
        'updated', v_updated,
        'pitches', v_pitches,
        'skipped', v_skipped,
        'failed', v_failed,
        'errors', v_errors);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

GRANT EXECUTE ON FUNCTION "sales-pipe".import_businesses TO authenticated, anon, service_role;

-- Update list_pitches to include whatsapp_number in phone fallback and match 4 categories exactly
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
               coalesce(b.phone, b.whatsapp_number) AS b_phone,
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
          AND (nullif(p_type, '') IS NULL 
               OR b.business_type = p_type
               OR (
                   CASE lower(trim(p_type))
                       WHEN 'restaurants and cafes' THEN b.business_type IN ('Restaurant', 'Cafe', 'Bakery', 'Takeaway', 'Restaurants and cafes', 'Restaurants and Cafes', 'Restaurants & cafes', 'Restaurants & Cafes', 'Restaurant or cafe')
                       WHEN 'restaurant or cafe' THEN b.business_type IN ('Restaurant', 'Cafe', 'Bakery', 'Takeaway', 'Restaurants and cafes', 'Restaurants and Cafes', 'Restaurants & cafes', 'Restaurants & Cafes', 'Restaurant or cafe')
                       WHEN 'hotels' THEN b.business_type IN ('Hotel', 'Boutique hotel', 'B&B / Guesthouse', 'Hotels', 'Hostel')
                       WHEN 'hotel' THEN b.business_type IN ('Hotel', 'Boutique hotel', 'B&B / Guesthouse', 'Hotels', 'Hostel')
                       WHEN 'pubs' THEN b.business_type IN ('Pub / Bar', 'Pub', 'Bar', 'Pubs', 'Public house')
                       WHEN 'pub' THEN b.business_type IN ('Pub / Bar', 'Pub', 'Bar', 'Pubs', 'Public house')
                       WHEN 'property management' THEN b.business_type IN ('Property Management', 'Property management', 'Short-let / Airbnb host', 'Serviced apartments')
                       ELSE false
                   END
               ))
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
           OR base.stage = p_filter
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
                      ORDER BY array_position(ARRAY['WhatsApp','Instagram','Facebook','Email','Phone','Walk-in'], t.platform))
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

GRANT EXECUTE ON FUNCTION "sales-pipe".list_pitches TO authenticated, anon, service_role;

