-- ==============================================================================
-- 30_v2_filter_types.sql
-- Update list_pitches to support consolidated type filters:
-- - 'Restaurants and cafes' -> Restaurant, Cafe, Bakery, Takeaway, etc.
-- - 'Hotels' -> Hotel, Boutique hotel, B&B / Guesthouse, Hotels, Hostel
-- - 'Pubs' -> Pub / Bar, Pub, Bar, Pubs, Public house
-- - 'Property Management' -> Property Management, Short-let / Airbnb host, Serviced apartments
-- ==============================================================================

SET search_path TO "sales-pipe", public;

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
               b.address AS b_address, b.google_rating AS b_rating, b.phone AS b_phone, b.email AS b_email,
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
                       WHEN 'restaurants and cafes' THEN b.business_type IN ('Restaurant', 'Cafe', 'Bakery', 'Takeaway', 'Restaurants and cafes', 'Restaurants and Cafes', 'Restaurants & cafes', 'Restaurants & Cafes')
                       WHEN 'hotels' THEN b.business_type IN ('Hotel', 'Boutique hotel', 'B&B / Guesthouse', 'Hotels', 'Hostel')
                       WHEN 'pubs' THEN b.business_type IN ('Pub / Bar', 'Pub', 'Bar', 'Pubs', 'Public house')
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
             WHERE t.opportunity_id = f.id AND t.status IN ('Not contacted', 'Awaiting reply')),
           f.b_needs_reply,
           count(*) OVER ()
    FROM filtered f
    ORDER BY f.b_needs_reply DESC,
             (SELECT min(t.next_due_on) FROM "sales-pipe".threads t
               WHERE t.opportunity_id = f.id AND t.status IN ('Not contacted', 'Awaiting reply')) ASC NULLS LAST,
             f.created_at DESC
    LIMIT least(coalesce(p_limit, 24), 500) OFFSET greatest(coalesce(p_offset, 0), 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

GRANT EXECUTE ON FUNCTION "sales-pipe".list_pitches TO authenticated, anon, service_role;
