-- ==============================================================================
-- 17_v2_functions_part3.sql
-- Daily update and UI aggregation functions (Views)
-- ==============================================================================

SET search_path TO "sales-pipe", public;

-- ==============================================================================
-- DAILY UPDATE
-- ==============================================================================

CREATE OR REPLACE FUNCTION "sales-pipe".daily_update()
RETURNS void AS $$
DECLARE
    t record;
BEGIN
    -- 1. Create drafts for threads whose next_due_on <= today and step < 4
    FOR t IN 
        SELECT t.id, t.step 
        FROM "sales-pipe".threads t
        WHERE t.next_due_on <= CURRENT_DATE 
          AND t.step < 4
          AND t.status IN ('Not contacted', 'Awaiting reply')
    LOOP
        PERFORM "sales-pipe".generate_draft(
            t.id, 
            CASE 
                WHEN t.step = 0 THEN 'First contact'
                WHEN t.step = 1 THEN 'Follow-up 1'
                WHEN t.step = 2 THEN 'Follow-up 2'
                WHEN t.step = 3 THEN 'Final check'
            END
        );
    END LOOP;

    -- 2. Mark threads No reply when final check was sent 14+ days ago
    UPDATE "sales-pipe".threads
    SET status = 'No reply', next_due_on = NULL
    WHERE step = 4 
      AND status = 'Awaiting reply'
      AND last_outbound_at < (CURRENT_DATE - interval '14 days'); -- Should be working days in prod

    -- 3. Set opportunity No response when every contacted thread is No reply
    UPDATE "sales-pipe".opportunities o
    SET stage = 'No response'
    WHERE o.stage = 'Active'
      AND NOT EXISTS (
          SELECT 1 FROM "sales-pipe".threads t 
          WHERE t.opportunity_id = o.id AND t.status != 'No reply' AND t.step > 0
      )
      AND NOT EXISTS (
          SELECT 1 FROM "sales-pipe".threads t 
          WHERE t.opportunity_id = o.id AND t.last_inbound_at IS NOT NULL
      );

    -- 4. Set opportunity Went cold when business replied at least once, 
    -- then we sent 2+ outbound, latest is 5+ days old, no answer.
    UPDATE "sales-pipe".opportunities o
    SET stage = 'Went cold'
    WHERE o.stage IN ('Active', 'Interested')
      AND EXISTS (
          SELECT 1 FROM "sales-pipe".threads t
          WHERE t.opportunity_id = o.id AND t.last_inbound_at IS NOT NULL
      )
      AND EXISTS (
          SELECT 1 FROM "sales-pipe".threads t
          WHERE t.opportunity_id = o.id 
            AND t.last_outbound_at > t.last_inbound_at
            AND t.last_outbound_at < (CURRENT_DATE - interval '5 days')
            AND (SELECT count(*) FROM "sales-pipe".messages m WHERE m.thread_id = t.id AND m.direction = 'outbound' AND m.created_at > t.last_inbound_at) >= 2
      );

    -- 5. Upsell drafts
    FOR t IN 
        SELECT id FROM "sales-pipe".opportunities
        WHERE stage = 'Won' AND upsell_reminder_on <= CURRENT_DATE
    LOOP
        INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
        SELECT assigned_sales_id, 'upsell_due', 'Upsell due for ' || (SELECT business_name FROM "sales-pipe".businesses WHERE id = t.business_id), '/dashboard'
        FROM "sales-pipe".opportunities WHERE id = t.id;
        
        -- Prevent spamming notifications by pushing the date far out or nulling it
        UPDATE "sales-pipe".opportunities SET upsell_reminder_on = NULL WHERE id = t.id;
    END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- UI AGGREGATION RPCs (VIEWS)
-- ==============================================================================

-- Dashboard Status Counts
CREATE OR REPLACE FUNCTION "sales-pipe".v_dashboard_status_counts(p_user uuid)
RETURNS TABLE (
    needs_reply bigint,
    interested bigint,
    consultation bigint,
    went_cold bigint,
    no_response bigint,
    needs_consultant bigint,
    unmatched_bookings bigint
) AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role FROM "sales-pipe".profiles WHERE id = p_user;

    RETURN QUERY
    SELECT
        (SELECT count(*) FROM "sales-pipe".threads t JOIN "sales-pipe".opportunities o ON t.opportunity_id = o.id WHERE (v_role = 'admin' OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user) AND t.status = 'Replied'),
        (SELECT count(*) FROM "sales-pipe".opportunities o WHERE (v_role = 'admin' OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user) AND o.stage = 'Interested'),
        (SELECT count(*) FROM "sales-pipe".opportunities o WHERE (v_role = 'admin' OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user) AND o.stage = 'Consultation'),
        (SELECT count(*) FROM "sales-pipe".opportunities o WHERE (v_role = 'admin' OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user) AND o.stage = 'Went cold'),
        (SELECT count(*) FROM "sales-pipe".opportunities o WHERE (v_role = 'admin' OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user) AND o.stage = 'No response'),
        (CASE WHEN v_role = 'admin' THEN (SELECT count(*) FROM "sales-pipe".opportunities WHERE stage = 'Consultation' AND assigned_consultant_id IS NULL) ELSE 0 END),
        (CASE WHEN v_role = 'admin' THEN (SELECT count(*) FROM "sales-pipe".consultation_bookings WHERE match_status = 'unmatched') ELSE 0 END);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Service Counts
CREATE OR REPLACE FUNCTION "sales-pipe".v_service_counts(p_user uuid)
RETURNS TABLE (
    service_name text,
    replies_count bigint,
    active_count bigint,
    won_count bigint
) AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role FROM "sales-pipe".profiles WHERE id = p_user;

    RETURN QUERY
    SELECT 
        s.srv AS service_name,
        COUNT(DISTINCT CASE WHEN t.status = 'Replied' THEN o.id END) AS replies_count,
        COUNT(DISTINCT CASE WHEN o.stage = 'Active' THEN o.id END) AS active_count,
        COUNT(DISTINCT CASE WHEN o.stage = 'Won' THEN o.id END) AS won_count
    FROM unnest(ARRAY['Website', 'Micro Automation', 'End-to-End Automation', 'Custom Dashboard', 'Cold Outreach']) AS s(srv)
    LEFT JOIN "sales-pipe".opportunities o ON s.srv = ANY(o.services_pitched) AND (v_role = 'admin' OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user)
    LEFT JOIN "sales-pipe".threads t ON t.opportunity_id = o.id
    GROUP BY s.srv;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Business Type Counts
CREATE OR REPLACE FUNCTION "sales-pipe".v_business_type_counts(p_service text, p_user uuid)
RETURNS TABLE (
    business_type text,
    businesses_count bigint,
    replies_count bigint,
    due_today_count bigint
) AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role FROM "sales-pipe".profiles WHERE id = p_user;

    RETURN QUERY
    SELECT 
        b.business_type,
        COUNT(DISTINCT b.id) AS businesses_count,
        COUNT(DISTINCT CASE WHEN t.status = 'Replied' THEN o.id END) AS replies_count,
        COUNT(DISTINCT CASE WHEN t.next_due_on <= CURRENT_DATE THEN o.id END) AS due_today_count
    FROM "sales-pipe".businesses b
    JOIN "sales-pipe".opportunities o ON o.business_id = b.id
    LEFT JOIN "sales-pipe".threads t ON t.opportunity_id = o.id
    WHERE p_service = ANY(o.services_pitched)
      AND (v_role = 'admin' OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user)
    GROUP BY b.business_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The other views (v_business_cards, v_due_today) will be implemented as standard joins in Next.js to leverage PostgREST pagination easily, as custom RPCs for pagination require manual OFFSET/LIMIT handling.
