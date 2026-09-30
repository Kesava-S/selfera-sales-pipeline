-- ==============================================================================
-- 13_analytics_and_duplicates.sql
-- Additive Migration:
-- 1. Additive columns on "sales-pipe".leads (won_at, lost_at, deal_value)
-- 2. Additive update to record_outreach to timestamp won_at/lost_at
-- 3. Duplicate lead check function (check_duplicate_lead)
-- 4. Pipeline analytics aggregation view (pipeline_analytics)
-- Schema: "sales-pipe"
-- ==============================================================================

-- 1. ADDITIVE COLUMNS ON LEADS TABLE
ALTER TABLE "sales-pipe".leads
ADD COLUMN IF NOT EXISTS won_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deal_value NUMERIC(12, 2) DEFAULT 0.00;

-- Indexes for performant filtering & duplicate detection
CREATE INDEX IF NOT EXISTS idx_leads_won_at ON "sales-pipe".leads(won_at);
CREATE INDEX IF NOT EXISTS idx_leads_lost_at ON "sales-pipe".leads(lost_at);
CREATE INDEX IF NOT EXISTS idx_leads_deal_value ON "sales-pipe".leads(deal_value);
CREATE INDEX IF NOT EXISTS idx_leads_email_lower ON "sales-pipe".leads(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_leads_phone ON "sales-pipe".leads(phone);

-- 2. DUPLICATE DETECTION FUNCTION
-- Searches for existing leads matching clean email or phone digits
CREATE OR REPLACE FUNCTION "sales-pipe".check_duplicate_lead(
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    lead_code TEXT,
    business_name TEXT,
    email TEXT,
    phone TEXT,
    channel TEXT,
    stage TEXT,
    current_service TEXT,
    follow_up_count INT,
    assigned_to TEXT,
    created_at TIMESTAMPTZ,
    match_reason TEXT
) AS $$
DECLARE
    v_clean_email TEXT;
    v_clean_phone TEXT;
    v_digits_phone TEXT;
BEGIN
    v_clean_email := NULLIF(LOWER(TRIM(p_email)), '');
    v_clean_phone := NULLIF(TRIM(p_phone), '');
    v_digits_phone := NULLIF(REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g'), '');

    -- If neither valid email nor phone provided, return empty set
    IF v_clean_email IS NULL AND v_digits_phone IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        l.id,
        l.lead_code,
        l.business_name,
        l.email,
        l.phone,
        l.channel,
        l.stage,
        l.current_service,
        l.follow_up_count,
        l.assigned_to,
        l.created_at,
        CASE 
            WHEN v_clean_email IS NOT NULL AND LOWER(TRIM(COALESCE(l.email, ''))) = v_clean_email 
                 AND v_digits_phone IS NOT NULL AND REGEXP_REPLACE(COALESCE(l.phone, ''), '[^0-9]', '', 'g') = v_digits_phone
                THEN 'Both Email and Phone matched'
            WHEN v_clean_email IS NOT NULL AND LOWER(TRIM(COALESCE(l.email, ''))) = v_clean_email 
                THEN 'Email address matched'
            ELSE 'Phone number matched'
        END AS match_reason
    FROM "sales-pipe".leads l
    WHERE 
        (v_clean_email IS NOT NULL AND LOWER(TRIM(COALESCE(l.email, ''))) = v_clean_email)
        OR 
        (
            v_digits_phone IS NOT NULL 
            AND LENGTH(v_digits_phone) >= 7
            AND (
                REGEXP_REPLACE(COALESCE(l.phone, ''), '[^0-9]', '', 'g') = v_digits_phone
                OR REGEXP_REPLACE(COALESCE(l.phone, ''), '[^0-9]', '', 'g') LIKE '%' || RIGHT(v_digits_phone, 8)
                OR v_digits_phone LIKE '%' || RIGHT(REGEXP_REPLACE(COALESCE(l.phone, ''), '[^0-9]', '', 'g'), 8)
            )
        )
    ORDER BY l.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION "sales-pipe".check_duplicate_lead(TEXT, TEXT) TO anon, authenticated, service_role;

-- 3. PIPELINE ANALYTICS AGGREGATION VIEW
CREATE OR REPLACE VIEW "sales-pipe".pipeline_analytics AS
SELECT 
    stage,
    COUNT(*)::INT AS lead_count,
    COALESCE(SUM(
        CASE 
            WHEN deal_value IS NOT NULL AND deal_value > 0 THEN deal_value
            WHEN current_service = 'Website Services' THEN 2500
            WHEN current_service = 'Dashboard Services' THEN 3500
            WHEN current_service = 'Micro Services' THEN 1800
            WHEN current_service = 'End to End Automation' THEN 4000
            WHEN current_service = 'Cold Outreach' THEN 1500
            ELSE 2000
        END
    ), 0)::NUMERIC(12, 2) AS stage_value,
    ROUND(AVG(COALESCE(follow_up_count, 0)), 1)::NUMERIC(4, 1) AS avg_follow_up_count,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END)::INT AS leads_last_30_days,
    COUNT(CASE WHEN won_at IS NOT NULL THEN 1 END)::INT AS won_count,
    COUNT(CASE WHEN lost_at IS NOT NULL THEN 1 END)::INT AS lost_count
FROM "sales-pipe".leads
GROUP BY stage;

GRANT ALL ON TABLE "sales-pipe".pipeline_analytics TO anon, authenticated, service_role;

-- 4. ADDITIVE EXTENSION TO record_outreach FOR won_at / lost_at TIMESTAMPS
-- Preserves all existing stage, follow-up cadence, and task logic intact
CREATE OR REPLACE FUNCTION "sales-pipe".record_outreach(
    p_lead_id uuid,
    p_action text,
    p_task_id uuid DEFAULT NULL,
    p_details text DEFAULT NULL,
    p_reply_channel text DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_lead record;
    v_next_date date;
    v_new_stage text;
    v_channel text;
    v_won_at timestamptz;
    v_lost_at timestamptz;
BEGIN
    SELECT * INTO v_lead FROM "sales-pipe".leads WHERE id = p_lead_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found';
    END IF;

    v_next_date := v_lead.next_follow_up;
    v_new_stage := v_lead.stage;
    v_channel := v_lead.channel;
    v_won_at := v_lead.won_at;
    v_lost_at := v_lead.lost_at;

    IF p_reply_channel IS NOT NULL AND p_reply_channel IN ('Email', 'WhatsApp', 'Instagram', 'Phone', 'Walk-in') THEN
        v_channel := p_reply_channel;
    END IF;

    IF p_action = 'sent' THEN
        v_new_stage := 'Contacted';
        IF v_lead.follow_up_count = 0 THEN
            v_next_date := "sales-pipe".add_working_days(CURRENT_DATE, 3);
        ELSIF v_lead.follow_up_count = 1 THEN
            v_next_date := "sales-pipe".add_working_days(CURRENT_DATE, 5);
        ELSIF v_lead.follow_up_count = 2 THEN
            v_next_date := "sales-pipe".add_working_days(CURRENT_DATE, 14);
        END IF;
        
        UPDATE "sales-pipe".leads 
        SET stage = v_new_stage,
            channel = v_channel,
            follow_up_count = follow_up_count + 1,
            next_follow_up = v_next_date
        WHERE id = p_lead_id;

        INSERT INTO "sales-pipe".activity_log (lead_id, action_type, details, created_by)
        VALUES (p_lead_id, 'sent', COALESCE(p_details, 'Message sent via ' || v_channel), 'sales-1');

        INSERT INTO "sales-pipe".user_logs (action, entity_type, entity_id, details)
        VALUES ('record_outreach_sent', 'lead', p_lead_id::text, jsonb_build_object('channel', v_channel, 'follow_up_count', v_lead.follow_up_count + 1));

    ELSIF p_action = 'no_reply_final' THEN
        UPDATE "sales-pipe".leads 
        SET stage = 'Lost', 
            next_follow_up = NULL,
            lost_at = COALESCE(lost_at, NOW())
        WHERE id = p_lead_id;

        INSERT INTO "sales-pipe".activity_log (lead_id, action_type, details, created_by)
        VALUES (p_lead_id, 'system', 'Final check: no reply. Marked as lost.', 'system');

        INSERT INTO "sales-pipe".app_logs (event, category, details)
        VALUES ('lead_auto_closed_lost', 'pipeline', jsonb_build_object('lead_id', p_lead_id));

    ELSIF p_action IN ('replied', 'interested', 'won', 'lost', 'do_not_contact', 'new') THEN
        IF p_action = 'new' THEN
            v_new_stage := 'New';
            v_next_date := CURRENT_DATE;
        ELSIF p_action = 'replied' THEN
            v_new_stage := 'Replied';
            v_next_date := NULL;
        ELSIF p_action = 'interested' THEN
            v_new_stage := 'Interested';
            v_next_date := "sales-pipe".add_working_days(CURRENT_DATE, 2);
        ELSIF p_action = 'won' THEN
            v_new_stage := 'Won';
            v_next_date := CURRENT_DATE + interval '30 days';
            v_won_at := COALESCE(v_won_at, NOW());
        ELSIF p_action = 'lost' THEN
            v_new_stage := 'Lost';
            v_next_date := NULL;
            v_lost_at := COALESCE(v_lost_at, NOW());
        ELSIF p_action = 'do_not_contact' THEN
            v_new_stage := 'Do not contact';
            v_next_date := NULL;
        END IF;

        UPDATE "sales-pipe".leads 
        SET stage = v_new_stage,
            channel = v_channel,
            next_follow_up = v_next_date,
            won_at = v_won_at,
            lost_at = v_lost_at
        WHERE id = p_lead_id;

        INSERT INTO "sales-pipe".activity_log (lead_id, action_type, details, created_by)
        VALUES (p_lead_id, 'note', 'Stage updated to ' || v_new_stage || CASE WHEN p_reply_channel IS NOT NULL THEN ' via ' || p_reply_channel ELSE '' END, 'sales-1');

        INSERT INTO "sales-pipe".user_logs (action, entity_type, entity_id, details)
        VALUES ('update_stage', 'lead', p_lead_id::text, jsonb_build_object('new_stage', v_new_stage, 'channel', v_channel));
    END IF;

    -- If a task was provided, mark it as completed
    IF p_task_id IS NOT NULL THEN
        UPDATE "sales-pipe".tasks SET status = 'completed' WHERE id = p_task_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
