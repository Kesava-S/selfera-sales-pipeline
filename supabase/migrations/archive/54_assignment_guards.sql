-- ==============================================================================
-- 54_assignment_guards.sql
-- Approved leads always get a sales person:
--   1. set_stage: a lead in "Needs review" can only be closed (Declined / Do not
--      contact / Went cold / No response). Starting outreach goes through the
--      Approval queue, which creates the conversations and assigns someone.
--   2. record_outbound: nothing can be sent to a lead in "Needs review"
--      (it used to turn the lead Active with nobody assigned).
--   3. Safety net: whenever a pitch becomes Active or Interested with no sales
--      person (e.g. a reply reopens a cold lead), auto_assign_sales runs at the
--      end of the transaction, after approve_import has done its own assigning.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. set_stage (same as live, plus the Needs review guard)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".set_stage(p_opportunity_id uuid, p_stage text, p_reason text, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_old text;
BEGIN
    PERFORM "sales-pipe".check_opp_access(p_opportunity_id);
    SELECT stage INTO v_old FROM "sales-pipe".opportunities WHERE id = p_opportunity_id;
    IF v_old = 'Needs review' AND p_stage NOT IN ('Needs review', 'Declined', 'Do not contact', 'Went cold', 'No response') THEN
        RAISE EXCEPTION 'Approve this lead from the Approval queue first';
    END IF;
    IF v_old IS DISTINCT FROM p_stage THEN
        UPDATE "sales-pipe".opportunities
        SET stage = p_stage,
            closed_at = CASE WHEN p_stage IN ('Declined', 'Do not contact', 'No response') THEN now() ELSE closed_at END
        WHERE id = p_opportunity_id;
        IF p_stage = 'Do not contact' THEN
            UPDATE "sales-pipe".threads SET status = 'Opted out', next_due_on = NULL WHERE opportunity_id = p_opportunity_id;
        END IF;
        INSERT INTO "sales-pipe".stage_changes (opportunity_id, from_stage, to_stage, reason, changed_by)
        VALUES (p_opportunity_id, v_old, p_stage, p_reason, coalesce(p_user_id, auth.uid()));
    END IF;
END;
$function$;

-- ------------------------------------------------------------------------------
-- 2. record_outbound (same as live, but refuses leads still in Needs review)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".record_outbound(p_thread_id uuid, p_body text, p_subject text, p_template_id uuid, p_send_method text, p_external_message_id text, p_sent_by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_thread record;
    v_opp record;
    v_new_step int;
    v_days int;
BEGIN
    SELECT * INTO v_thread FROM "sales-pipe".threads WHERE id = p_thread_id;
    IF v_thread.id IS NULL THEN RAISE EXCEPTION 'Thread not found'; END IF;
    SELECT * INTO v_opp FROM "sales-pipe".opportunities WHERE id = v_thread.opportunity_id;
    PERFORM "sales-pipe".check_opp_access(v_opp.id);
    IF v_opp.stage = 'Do not contact' OR v_thread.status = 'Opted out' THEN
        RAISE EXCEPTION 'This business asked not to be contacted';
    END IF;
    IF v_opp.stage = 'Needs review' THEN
        RAISE EXCEPTION 'Approve this lead first';
    END IF;
    IF coalesce(trim(p_body), '') = '' THEN
        RAISE EXCEPTION 'The message is empty';
    END IF;
    v_new_step := least(v_thread.step + 1, 4);
    SELECT days_delay INTO v_days FROM "sales-pipe".cadence_rules
    WHERE step_name = CASE v_new_step WHEN 1 THEN 'Follow up 1' WHEN 2 THEN 'Follow up 2' WHEN 3 THEN 'Follow up 3' END;
    v_days := CASE WHEN v_new_step < 4 THEN coalesce(v_days, CASE v_new_step WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 14 END) END;
    IF v_thread.status = 'Replied' THEN
        INSERT INTO "sales-pipe".messages (thread_id, direction, body, subject, template_id, step_label, send_method, external_message_id, sent_by, delivery_status)
        VALUES (p_thread_id, 'outbound', p_body, p_subject, p_template_id, 'Reply', p_send_method, p_external_message_id, coalesce(p_sent_by, auth.uid()), 'sent');
        UPDATE "sales-pipe".threads SET last_outbound_at = now() WHERE id = p_thread_id;
        UPDATE "sales-pipe".drafts SET status = 'sent' WHERE thread_id = p_thread_id AND status IN ('ready', 'needs_data');
        RETURN;
    END IF;
    INSERT INTO "sales-pipe".messages (thread_id, direction, body, subject, template_id, step_label, send_method, external_message_id, sent_by, delivery_status)
    VALUES (
        p_thread_id, 'outbound', p_body, p_subject, p_template_id,
        CASE v_thread.step WHEN 0 THEN 'First contact' WHEN 1 THEN 'Follow-up 1' WHEN 2 THEN 'Follow-up 2' ELSE 'Final check' END,
        p_send_method, p_external_message_id, coalesce(p_sent_by, auth.uid()), 'sent'
    );
    UPDATE "sales-pipe".threads
    SET step = v_new_step,
        status = 'Awaiting reply',
        paused_reason = NULL,
        next_due_on = CASE WHEN v_days IS NULL
                           THEN "sales-pipe".add_working_days(CURRENT_DATE, 14)  -- after the final check: wait, then No reply
                           ELSE "sales-pipe".add_working_days(CURRENT_DATE, v_days) END,
        last_outbound_at = now()
    WHERE id = p_thread_id;
    UPDATE "sales-pipe".drafts SET status = 'sent'
    WHERE thread_id = p_thread_id AND status IN ('ready', 'needs_data');
END;
$function$;

-- ------------------------------------------------------------------------------
-- 3. Safety net: open pitches without a sales person get one
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".trg_assign_open_pitch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    -- Runs at commit: look again, the transaction may already have assigned someone
    IF EXISTS (
        SELECT 1 FROM "sales-pipe".opportunities
        WHERE id = NEW.id AND stage IN ('Active', 'Interested') AND assigned_sales_id IS NULL
    ) THEN
        PERFORM "sales-pipe".auto_assign_sales(ARRAY[NEW.id]);
    END IF;
    RETURN NULL;
END;
$function$;

-- Only on stage changes and new pitches, so unassigning someone by hand still works
DROP TRIGGER IF EXISTS assign_open_pitch_on_stage ON "sales-pipe".opportunities;
CREATE CONSTRAINT TRIGGER assign_open_pitch_on_stage
    AFTER UPDATE OF stage ON "sales-pipe".opportunities
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    WHEN (NEW.stage IN ('Active', 'Interested') AND NEW.assigned_sales_id IS NULL AND OLD.stage IS DISTINCT FROM NEW.stage)
    EXECUTE FUNCTION "sales-pipe".trg_assign_open_pitch();

DROP TRIGGER IF EXISTS assign_open_pitch_on_insert ON "sales-pipe".opportunities;
CREATE CONSTRAINT TRIGGER assign_open_pitch_on_insert
    AFTER INSERT ON "sales-pipe".opportunities
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    WHEN (NEW.stage IN ('Active', 'Interested') AND NEW.assigned_sales_id IS NULL)
    EXECUTE FUNCTION "sales-pipe".trg_assign_open_pitch();

REVOKE ALL ON FUNCTION "sales-pipe".trg_assign_open_pitch() FROM PUBLIC, anon, authenticated;

COMMIT;
