-- ==============================================================================
-- 55_reopen_and_late_replies.sql
-- Closed leads (Went cold, No response, Declined, Do not contact):
--   - Nothing can be sent on any channel; the history stays.
--   - A reply no longer reopens the lead by itself. It is saved, the lead is
--     marked "replied after closing" and the owner is told; staff decide.
--   - Reopening (moving back to Active or Interested) starts a new round:
--     step 0 due today with a fresh draft. Earlier messages stay, shown as the
--     previous round. If the lead's late reply is what brought it back, that
--     conversation starts as "Replied" with a reply draft instead.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. New columns
-- ------------------------------------------------------------------------------
ALTER TABLE "sales-pipe".threads
    ADD COLUMN IF NOT EXISTS round int NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS round_started_at timestamptz;

ALTER TABLE "sales-pipe".opportunities
    ADD COLUMN IF NOT EXISTS replied_after_close_at timestamptz;

-- ------------------------------------------------------------------------------
-- 2. record_inbound: closed leads keep their stage and get the badge
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".record_inbound(p_platform text, p_external_thread_id text, p_from text, p_body text, p_external_message_id text, p_media_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_thread_id uuid;
    v_opp_id uuid;
    v_stage text;
BEGIN
    IF p_external_message_id IS NOT NULL AND EXISTS (SELECT 1 FROM "sales-pipe".messages WHERE external_message_id = p_external_message_id) THEN
        RETURN;
    END IF;
    SELECT id, opportunity_id INTO v_thread_id, v_opp_id
    FROM "sales-pipe".threads
    WHERE p_external_thread_id IS NOT NULL AND external_thread_id = p_external_thread_id AND platform = p_platform
    LIMIT 1;
    IF v_thread_id IS NULL THEN
        SELECT t.id, t.opportunity_id INTO v_thread_id, v_opp_id
        FROM "sales-pipe".threads t
        JOIN "sales-pipe".opportunities o ON t.opportunity_id = o.id
        JOIN "sales-pipe".businesses b ON o.business_id = b.id
        WHERE t.platform = p_platform
          AND o.stage IN ('Active', 'Interested', 'Consultation', 'Went cold', 'No response', 'Declined', 'Do not contact')
          AND (b.phone_normalised = "sales-pipe".normalise_phone(p_from)
               OR "sales-pipe".normalise_phone(b.whatsapp_number) = "sales-pipe".normalise_phone(p_from)
               OR b.email_normalised = "sales-pipe".normalise_email(p_from)
               OR lower(b.instagram) = lower(trim(both '@' FROM p_from))
               OR lower(b.facebook) = lower(p_from))
        -- An open pitch wins over a closed one for the same business
        ORDER BY (o.stage IN ('Active', 'Interested', 'Consultation')) DESC, t.created_at DESC LIMIT 1;
        IF v_thread_id IS NOT NULL AND p_external_thread_id IS NOT NULL THEN
            UPDATE "sales-pipe".threads SET external_thread_id = p_external_thread_id WHERE id = v_thread_id;
        END IF;
    END IF;
    IF v_thread_id IS NULL THEN
        RETURN; -- not one of our leads
    END IF;
    INSERT INTO "sales-pipe".messages (thread_id, direction, body, send_method, external_message_id, media_url)
    VALUES (v_thread_id, 'inbound', p_body, 'webhook', p_external_message_id, p_media_url);
    PERFORM "sales-pipe".discard_drafts(v_opp_id);
    SELECT stage INTO v_stage FROM "sales-pipe".opportunities WHERE id = v_opp_id;

    IF upper(trim(p_body)) IN ('STOP', 'STOP.', 'UNSUBSCRIBE') THEN
        UPDATE "sales-pipe".threads SET status = 'Opted out', next_due_on = NULL, last_inbound_at = now() WHERE opportunity_id = v_opp_id;
        IF v_stage IS DISTINCT FROM 'Do not contact' THEN
            UPDATE "sales-pipe".opportunities SET stage = 'Do not contact', closed_at = now(), replied_after_close_at = NULL WHERE id = v_opp_id;
        END IF;
        RETURN;
    END IF;

    IF v_stage IN ('Went cold', 'No response', 'Declined', 'Do not contact') THEN
        -- Closed: keep it closed, mark it, tell the owner
        UPDATE "sales-pipe".threads SET last_inbound_at = now() WHERE id = v_thread_id;
        UPDATE "sales-pipe".opportunities SET replied_after_close_at = now() WHERE id = v_opp_id;
        INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
        SELECT coalesce(o.assigned_consultant_id, o.assigned_sales_id), 'new_reply',
               b.business_name || ' replied on ' || p_platform || ' after being closed (' || v_stage || ')',
               '/dashboard/' || o.id
        FROM "sales-pipe".opportunities o JOIN "sales-pipe".businesses b ON b.id = o.business_id
        WHERE o.id = v_opp_id AND coalesce(o.assigned_consultant_id, o.assigned_sales_id) IS NOT NULL;
        RETURN;
    END IF;

    UPDATE "sales-pipe".threads
    SET status = 'Replied', next_due_on = NULL, last_inbound_at = now(), paused_reason = NULL
    WHERE id = v_thread_id;
    UPDATE "sales-pipe".threads
    SET status = 'Paused', paused_reason = 'Replied on ' || p_platform, next_due_on = NULL
    WHERE opportunity_id = v_opp_id AND id <> v_thread_id AND status IN ('Not contacted', 'Awaiting reply');
    INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
    SELECT coalesce(o.assigned_consultant_id, o.assigned_sales_id), 'new_reply',
           'New reply from ' || b.business_name || ' on ' || p_platform,
           '/dashboard/' || o.id || '/thread/' || v_thread_id
    FROM "sales-pipe".opportunities o JOIN "sales-pipe".businesses b ON b.id = o.business_id
    WHERE o.id = v_opp_id AND coalesce(o.assigned_consultant_id, o.assigned_sales_id) IS NOT NULL;
END;
$function$;

-- ------------------------------------------------------------------------------
-- 3. record_outbound: also refuses closed leads (same as 54 otherwise)
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
    IF v_opp.stage IN ('Went cold', 'No response', 'Declined') THEN
        RAISE EXCEPTION 'This lead is closed (%). Reopen it to send', v_opp.stage;
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
-- 4. Reopening starts a new round
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".trg_opp_reopen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_reply_thread uuid;
    v_platform text;
    t record;
BEGIN
    -- Drafts are signed with the sales person's name, so make sure there is one
    IF NEW.assigned_sales_id IS NULL THEN
        PERFORM "sales-pipe".auto_assign_sales(ARRAY[NEW.id]);
    END IF;

    -- The late reply that brought the lead back, if any
    IF OLD.replied_after_close_at IS NOT NULL THEN
        SELECT id, platform INTO v_reply_thread, v_platform FROM "sales-pipe".threads
        WHERE opportunity_id = NEW.id AND last_inbound_at >= OLD.replied_after_close_at - interval '1 minute'
        ORDER BY last_inbound_at DESC LIMIT 1;
    END IF;

    -- The new round starts just before the late reply, so that reply shows as current
    UPDATE "sales-pipe".threads
    SET round = round + 1,
        round_started_at = CASE WHEN v_reply_thread IS NOT NULL THEN OLD.replied_after_close_at - interval '1 second' ELSE now() END,
        step = 0,
        status = CASE WHEN id = v_reply_thread THEN 'Replied'
                      WHEN v_reply_thread IS NOT NULL THEN 'Paused'
                      ELSE 'Not contacted' END,
        paused_reason = CASE WHEN v_reply_thread IS NOT NULL AND id <> v_reply_thread THEN 'Replied on ' || v_platform END,
        next_due_on = CASE WHEN v_reply_thread IS NULL THEN CURRENT_DATE END
    WHERE opportunity_id = NEW.id;

    UPDATE "sales-pipe".opportunities SET replied_after_close_at = NULL, closed_at = NULL WHERE id = NEW.id;

    FOR t IN SELECT id FROM "sales-pipe".threads WHERE opportunity_id = NEW.id AND status IN ('Not contacted', 'Replied') LOOP
        PERFORM "sales-pipe".generate_draft(t.id, CASE WHEN t.id = v_reply_thread THEN 'Reply' ELSE 'First contact' END);
    END LOOP;
    RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_opp_reopen ON "sales-pipe".opportunities;
CREATE TRIGGER trg_opp_reopen
    AFTER UPDATE OF stage ON "sales-pipe".opportunities
    FOR EACH ROW
    WHEN (OLD.stage IN ('Went cold', 'No response', 'Declined', 'Do not contact') AND NEW.stage IN ('Active', 'Interested'))
    EXECUTE FUNCTION "sales-pipe".trg_opp_reopen();

-- ------------------------------------------------------------------------------
-- 5. Staff decide not to reopen after a late reply
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".dismiss_late_reply(p_opportunity_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    PERFORM "sales-pipe".check_opp_access(p_opportunity_id);
    UPDATE "sales-pipe".opportunities SET replied_after_close_at = NULL WHERE id = p_opportunity_id;
END;
$function$;

REVOKE ALL ON FUNCTION "sales-pipe".trg_opp_reopen() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "sales-pipe".dismiss_late_reply(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "sales-pipe".dismiss_late_reply(uuid) TO authenticated, service_role;

COMMIT;
