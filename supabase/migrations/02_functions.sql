CREATE OR REPLACE FUNCTION add_working_days(start_date date, days int)
RETURNS date AS $$
DECLARE
    result date := start_date;
    added int := 0;
BEGIN
    WHILE added < days LOOP
        result := result + interval '1 day';
        -- Extract DOW (0=Sun, 1=Mon, ..., 6=Sat)
        IF extract(dow from result) NOT IN (0, 6) THEN
            added := added + 1;
        END IF;
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION record_outreach(
    p_lead_id uuid,
    p_action text,
    p_task_id uuid DEFAULT NULL,
    p_details text DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_lead record;
    v_next_date date;
    v_new_stage text;
BEGIN
    SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found';
    END IF;

    v_next_date := v_lead.next_follow_up;
    v_new_stage := v_lead.stage;

    IF p_action = 'sent' THEN
        v_new_stage := 'Contacted';
        IF v_lead.follow_up_count = 0 THEN
            v_next_date := add_working_days(CURRENT_DATE, 3);
        ELSIF v_lead.follow_up_count = 1 THEN
            v_next_date := add_working_days(CURRENT_DATE, 5);
        ELSIF v_lead.follow_up_count = 2 THEN
            v_next_date := add_working_days(CURRENT_DATE, 14);
        END IF;
        
        UPDATE leads 
        SET stage = v_new_stage,
            follow_up_count = follow_up_count + 1,
            next_follow_up = v_next_date
        WHERE id = p_lead_id;

        INSERT INTO activity_log (lead_id, action_type, details, created_by)
        VALUES (p_lead_id, 'sent', COALESCE(p_details, 'Message sent'), auth.uid());

    ELSIF p_action = 'no_reply_final' THEN
        UPDATE leads SET stage = 'Lost', next_follow_up = NULL WHERE id = p_lead_id;
        INSERT INTO activity_log (lead_id, action_type, details, created_by)
        VALUES (p_lead_id, 'system', 'Final check: no reply. Marked as lost.', auth.uid());

    ELSIF p_action IN ('replied', 'interested', 'won', 'lost', 'do_not_contact') THEN
        IF p_action = 'replied' THEN
            v_new_stage := 'Replied';
            v_next_date := NULL;
        ELSIF p_action = 'interested' THEN
            v_new_stage := 'Interested';
            v_next_date := add_working_days(CURRENT_DATE, 2);
        ELSIF p_action = 'won' THEN
            v_new_stage := 'Won';
            v_next_date := CURRENT_DATE + interval '30 days'; -- Standard 30 days
        ELSIF p_action = 'lost' THEN
            v_new_stage := 'Lost';
            v_next_date := NULL;
        ELSIF p_action = 'do_not_contact' THEN
            v_new_stage := 'Do not contact';
            v_next_date := NULL;
        END IF;

        UPDATE leads 
        SET stage = v_new_stage,
            next_follow_up = v_next_date
        WHERE id = p_lead_id;

        INSERT INTO activity_log (lead_id, action_type, details, created_by)
        VALUES (p_lead_id, 'note', 'Stage updated to ' || v_new_stage, auth.uid());
    END IF;

    -- If a task was provided, mark it as completed.
    -- (Assuming 'completed' is a valid status in the tasks table)
    IF p_task_id IS NOT NULL THEN
        UPDATE tasks SET status = 'completed' WHERE id = p_task_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for n8n to query leads due for follow up today
CREATE OR REPLACE VIEW leads_due_today AS
SELECT * FROM leads
WHERE next_follow_up <= CURRENT_DATE
  AND stage NOT IN ('Replied', 'Lost', 'Do not contact');
