-- ==============================================================================
-- 09_functions_and_views.sql
-- Functions & Views for automated cadence calculations and n8n triggers
-- ==============================================================================

-- 1. Helper function: Add working days (skips Sat & Sun)
CREATE OR REPLACE FUNCTION "sales-pipe".add_working_days(start_date date, days int)
RETURNS date AS $$
DECLARE
    result date := start_date;
    added int := 0;
BEGIN
    WHILE added < days LOOP
        result := result + interval '1 day';
        IF extract(dow from result) NOT IN (0, 6) THEN
            added := added + 1;
        END IF;
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Core function: record_outreach
-- Updates lead stage, follow_up_count, next_follow_up date, logs activity, and completes task
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
BEGIN
    SELECT * INTO v_lead FROM "sales-pipe".leads WHERE id = p_lead_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found';
    END IF;

    v_next_date := v_lead.next_follow_up;
    v_new_stage := v_lead.stage;
    v_channel := v_lead.channel;

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
        UPDATE "sales-pipe".leads SET stage = 'Lost', next_follow_up = NULL WHERE id = p_lead_id;
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
        ELSIF p_action = 'lost' THEN
            v_new_stage := 'Lost';
            v_next_date := NULL;
        ELSIF p_action = 'do_not_contact' THEN
            v_new_stage := 'Do not contact';
            v_next_date := NULL;
        END IF;

        UPDATE "sales-pipe".leads 
        SET stage = v_new_stage,
            channel = v_channel,
            next_follow_up = v_next_date
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

-- 3. View for n8n daily automated follow-up cadences
CREATE OR REPLACE VIEW "sales-pipe".leads_due_today AS
SELECT * FROM "sales-pipe".leads
WHERE next_follow_up <= CURRENT_DATE
  AND stage NOT IN ('Replied', 'Lost', 'Do not contact');
