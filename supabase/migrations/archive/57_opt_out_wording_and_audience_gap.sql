-- ==============================================================================
-- 57_opt_out_wording_and_audience_gap.sql
--   1. "Opt-Out" instead of "unsubscribe" in what people read: notifications,
--      the do-not-contact reason and the activity log. (Internal names such as
--      the source value 'unsubscribe' and the notification type stay.)
--   2. A reply of "OPT OUT" now works like "STOP".
--   3. Settings: the gap between two Client Audience campaign messages to the
--      same person (stored with the follow-up timings in cadence_rules).
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. record_unsubscribe (same as live, new wording)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".record_unsubscribe(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_email text := lower(trim(p_email));
    v_id uuid;
    v_name text;
BEGIN
    IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+$' THEN
        RAISE EXCEPTION 'Not an email address';
    END IF;

    IF EXISTS (SELECT 1 FROM "sales-pipe".opt_outs
               WHERE lower(identifier) = v_email AND lower(channel) IN ('all', 'email')) THEN
        RETURN jsonb_build_object('already', true);
    END IF;

    INSERT INTO "sales-pipe".opt_outs (identifier, channel, reason, source)
    VALUES (v_email, 'Email', 'Opted out using the link in our email', 'unsubscribe')
    RETURNING id INTO v_id;

    SELECT string_agg(DISTINCT b.business_name, ', ') INTO v_name
    FROM "sales-pipe".businesses b WHERE lower(b.email) = v_email;

    -- Tell the admins and whoever owns the lead
    INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
    SELECT DISTINCT ON (u.user_id) u.user_id, 'unsubscribed',
           coalesce(v_name, v_email) || ' opted out of emails',
           coalesce(u.link, '/dashboard/settings#do-not-contact')
    FROM (
        SELECT p.id AS user_id, NULL::text AS link
        FROM "sales-pipe".profiles p WHERE p.role = 'admin' AND p.is_active
        UNION ALL
        SELECT x.user_id, '/dashboard/' || o.id
        FROM "sales-pipe".opportunities o
        JOIN "sales-pipe".businesses b ON b.id = o.business_id
        CROSS JOIN LATERAL (VALUES (o.assigned_sales_id), (o.assigned_consultant_id)) x(user_id)
        WHERE lower(b.email) = v_email AND x.user_id IS NOT NULL
    ) u
    ORDER BY u.user_id, u.link NULLS LAST;

    INSERT INTO "sales-pipe".user_logs (user_name, action, entity_type, entity_id, details)
    VALUES ('Lead', 'opted_out', 'opt_out', v_id::text,
            jsonb_build_object('email', v_email, 'business', v_name));

    RETURN jsonb_build_object('already', false);
END;
$function$;

UPDATE "sales-pipe".opt_outs SET reason = 'Opted out using the link in our email' WHERE reason = 'Unsubscribed using the link in our email';
UPDATE "sales-pipe".notifications
SET title = replace(title, ' unsubscribed from emails', ' opted out of emails')
WHERE type = 'unsubscribed';
UPDATE "sales-pipe".user_logs SET action = 'opted_out' WHERE action = 'unsubscribed';

-- ------------------------------------------------------------------------------
-- 2. record_inbound (same as 55, more opt-out words)
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

    IF upper(regexp_replace(trim(p_body), '[.!]+$', '')) IN ('STOP', 'UNSUBSCRIBE', 'OPT OUT', 'OPT-OUT', 'OPTOUT') THEN
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
-- 3. Client Audience campaign gap
-- ------------------------------------------------------------------------------
INSERT INTO "sales-pipe".cadence_rules (step_name, days_delay, description)
VALUES ('Audience gap', 14, 'Days to wait before sending another Client Audience campaign message to the same person')
ON CONFLICT (step_name) DO NOTHING;

CREATE OR REPLACE FUNCTION "sales-pipe".set_cadence(p_step_name text, p_days integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin']);
    IF p_step_name IN ('Follow up 1', 'Follow up 2', 'Follow up 3') THEN
        IF p_days IS NULL OR p_days < 1 OR p_days > 60 THEN RAISE EXCEPTION 'Pick between 1 and 60 working days'; END IF;
    ELSIF p_step_name = 'Audience gap' THEN
        IF p_days IS NULL OR p_days < 1 OR p_days > 180 THEN RAISE EXCEPTION 'Pick between 1 and 180 days'; END IF;
    ELSE
        RAISE EXCEPTION 'Unknown step';
    END IF;
    UPDATE "sales-pipe".cadence_rules SET days_delay = p_days, updated_at = now() WHERE step_name = p_step_name;
END;
$function$;

COMMIT;
