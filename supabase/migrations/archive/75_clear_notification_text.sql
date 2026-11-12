-- ==============================================================================
-- 75_clear_notification_text.sql
-- Every notification reads as: a short title that names the business, and a
-- message that says what happened and what to do next.
--   before: "1 new pitch(es) assigned to you"            (no business, no next step)
--   after:  "1 new lead assigned to you"  /  "They're ready in Due today."
-- Done once, before the notification is saved, so the bell, the Notifications
-- page and the Admin Panel copy (migration 74) all get the same text. The
-- functions that create notifications are unchanged. Existing ones are rewritten.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

CREATE OR REPLACE FUNCTION "sales-pipe".notification_text(p_type text, p_title text, p_link text, OUT title text, OUT message text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v_opp uuid;
    v_biz text;
    v_consultant text;
    v_stage text;
    n int;
    m text[];
BEGIN
    title := p_title;
    message := NULL;

    -- The lead the notification points at (links look like /dashboard/<pitch id>...)
    m := regexp_match(coalesce(p_link, ''), '/dashboard/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})');
    IF m IS NOT NULL THEN
        v_opp := m[1]::uuid;
        SELECT b.business_name, o.stage, c.full_name INTO v_biz, v_stage, v_consultant
        FROM "sales-pipe".opportunities o
        JOIN "sales-pipe".businesses b ON b.id = o.business_id
        LEFT JOIN "sales-pipe".profiles c ON c.id = o.assigned_consultant_id
        WHERE o.id = v_opp;
    END IF;

    CASE p_type
    WHEN 'new_reply' THEN
        m := regexp_match(p_title, '^(.*) replied on (\S+) after being closed \((.*)\)$');
        IF m IS NOT NULL THEN
            title := 'Reply after closing: ' || coalesce(v_biz, m[1]);
            message := 'They wrote on ' || m[2] || ' after the lead was closed (' || m[3] || '). Reopen it to answer, or dismiss.';
        ELSE
            m := regexp_match(p_title, '^New reply from (.*) on (\S+)$');
            IF m IS NOT NULL THEN
                title := 'New reply: ' || coalesce(v_biz, m[1]);
                message := 'They replied on ' || m[2] || '. Open the chat to answer.';
            END IF;
        END IF;

    WHEN 'assigned_to_you' THEN
        IF p_title ~ '^\d+ new pitch\(es\) assigned to you$' THEN
            n := substring(p_title FROM '^(\d+)')::int;
            title := n || CASE WHEN n = 1 THEN ' new lead' ELSE ' new leads' END || ' assigned to you';
            message := 'Approved and ready to start. Find ' || CASE WHEN n = 1 THEN 'it' ELSE 'them' END || ' in Due today.';
        ELSIF p_title ~ '^\d+ business\(es\) assigned to you$' THEN
            n := substring(p_title FROM '^(\d+)')::int;
            title := n || CASE WHEN n = 1 THEN ' lead' ELSE ' leads' END || ' assigned to you';
            message := 'An admin gave ' || CASE WHEN n = 1 THEN 'it' ELSE 'them' END || ' to you. Find ' || CASE WHEN n = 1 THEN 'it' ELSE 'them' END || ' in Lead Management.';
        ELSIF p_title LIKE 'New pitches approved but no salesperson has capacity%' THEN
            title := 'Leads need assigning';
            message := 'Approved leads couldn''t be assigned: every sales person is at capacity. Assign them in Lead Management.';
        ELSIF p_title = 'You have been assigned a consultation' THEN
            title := 'Consultation assigned: ' || coalesce(v_biz, 'a lead');
            message := 'You''re the consultant for this lead. Open it to prepare.';
        ELSIF p_title = 'A consultant was assigned to your business' THEN
            title := 'Consultant assigned: ' || coalesce(v_biz, 'your lead');
            message := coalesce(v_consultant, 'A consultant') || ' will run the consultation.';
        END IF;

    WHEN 'needs_consultant' THEN
        title := 'Assign a consultant: ' || coalesce(v_biz, 'a lead');
        message := 'Ready for a consultation and has no consultant yet.';

    WHEN 'upsell_due' THEN
        title := 'Upsell due: ' || coalesce(v_biz, regexp_replace(p_title, '^Upsell due for ', ''));
        message := 'Time to offer more services. Open the lead.';

    WHEN 'unsubscribed' THEN
        m := regexp_match(p_title, '^(.*) opted out of (emails|WhatsApp)$');
        IF m IS NOT NULL THEN
            title := 'Opted out: ' || coalesce(v_biz, m[1]);
            message := CASE m[2]
                WHEN 'WhatsApp' THEN 'Replied STOP on WhatsApp. They won''t be messaged on WhatsApp again.'
                ELSE 'Unsubscribed from our emails. They won''t be emailed again.' END;
        END IF;

    WHEN 'booking_matched' THEN
        title := 'Consultation booked: ' || coalesce(v_biz, 'your lead');
        message := 'They booked a consultation. Open the lead to see the time.';

    WHEN 'booking_unmatched' THEN
        m := regexp_match(p_title, '^New booking from (.*) needs linking$');
        title := 'Booking to link: ' || coalesce(m[1], 'unknown business');
        message := 'A booking didn''t match any lead. Link it to the right business.';

    ELSE
        NULL;
    END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION "sales-pipe".trg_notification_text()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    t record;
BEGIN
    -- Only rewrite when the creator didn't write its own message
    IF NEW.message IS NULL THEN
        t := "sales-pipe".notification_text(NEW.type, NEW.title, NEW.link);
        NEW.title := t.title;
        NEW.message := t.message;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_text ON "sales-pipe".notifications;
CREATE TRIGGER trg_notification_text
    BEFORE INSERT ON "sales-pipe".notifications
    FOR EACH ROW EXECUTE FUNCTION "sales-pipe".trg_notification_text();

-- Rewrite the ones already saved
UPDATE "sales-pipe".notifications n
SET title = t.title, message = t.message
FROM (SELECT id, ("sales-pipe".notification_text(type, title, link)).* FROM "sales-pipe".notifications WHERE message IS NULL) t
WHERE n.id = t.id;

COMMIT;
