-- ==============================================================================
-- 73_all_opt_outs_listed.sql
-- Every opted-out lead, on any channel, is on the do-not-contact list
-- (opt_outs), so Settings → Do-not-contact shows them all.
--
-- Already listed before this migration:
--   * email unsubscribe link (record_unsubscribe)       source 'unsubscribe'
--   * email bounce / spam report (record_email_events)  source 'bounce' / 'complaint'
--   * WhatsApp STOP (record_whatsapp_opt_out, 70)        source 'inbound'
-- Added here:
--   * STOP / UNSUBSCRIBE replied in any lead chat (email, WhatsApp, Instagram,
--     Facebook, LinkedIn)                                 source 'inbound'
--   * STOP replied to a campaign, also from unknown senders   source 'inbound'
--   * a lead moved to "Do not contact" (by staff or after STOP): its email
--     and WhatsApp number                                 source 'stage'
--     Reopening the lead removes these 'stage' entries again (other entries stay).
-- Client Audience customers keep their own per-client opt-out (not listed here).
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

-- One entry per contact and channel (digits for numbers, lower case for the rest)
CREATE OR REPLACE FUNCTION "sales-pipe".add_opt_out(p_identifier text, p_channel text, p_reason text, p_source text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v_id text := nullif(trim(coalesce(p_identifier, '')), '');
    v_phone boolean := p_channel = 'WhatsApp';
BEGIN
    IF v_id IS NULL THEN RETURN false; END IF;
    IF v_phone THEN
        IF length(regexp_replace(v_id, '\D', '', 'g')) < 7 THEN RETURN false; END IF;
        v_id := "sales-pipe".normalise_phone(v_id);
    ELSE
        v_id := lower(v_id);
    END IF;
    IF EXISTS (
        SELECT 1 FROM "sales-pipe".opt_outs o
        WHERE lower(o.channel) IN ('all', lower(p_channel))
          AND CASE WHEN v_phone THEN regexp_replace(o.identifier, '\D', '', 'g') = regexp_replace(v_id, '\D', '', 'g')
                   ELSE lower(o.identifier) = v_id END
    ) THEN
        RETURN false;
    END IF;
    INSERT INTO "sales-pipe".opt_outs (identifier, channel, reason, source)
    VALUES (v_id, p_channel, left(p_reason, 300), p_source);
    RETURN true;
END;
$$;

-- STOP replied in a lead's chat
CREATE OR REPLACE FUNCTION "sales-pipe".trg_message_stop_opt_out()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v record;
BEGIN
    SELECT t.platform, b.email, b.whatsapp_number, b.instagram, b.facebook, b.linkedin INTO v
    FROM "sales-pipe".threads t
    JOIN "sales-pipe".opportunities o ON o.id = t.opportunity_id
    JOIN "sales-pipe".businesses b ON b.id = o.business_id
    WHERE t.id = NEW.thread_id;
    IF v.platform IS NULL THEN RETURN NULL; END IF;

    PERFORM "sales-pipe".add_opt_out(
        CASE v.platform WHEN 'WhatsApp' THEN v.whatsapp_number WHEN 'Email' THEN v.email
                        WHEN 'Instagram' THEN v.instagram WHEN 'Facebook' THEN v.facebook WHEN 'LinkedIn' THEN v.linkedin END,
        v.platform, 'Replied "' || left(trim(NEW.body), 40) || '" on ' || v.platform, 'inbound');
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_message_stop_opt_out ON "sales-pipe".messages;
CREATE TRIGGER trg_message_stop_opt_out
    AFTER INSERT ON "sales-pipe".messages
    FOR EACH ROW WHEN (NEW.direction = 'inbound' AND "sales-pipe".is_stop_reply(NEW.body))
    EXECUTE FUNCTION "sales-pipe".trg_message_stop_opt_out();

-- STOP replied to a campaign (known or unknown sender; Client Audience replies never get here)
CREATE OR REPLACE FUNCTION "sales-pipe".trg_campaign_reply_stop_opt_out()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
BEGIN
    PERFORM "sales-pipe".add_opt_out(
        NEW.from_address, CASE NEW.channel WHEN 'whatsapp' THEN 'WhatsApp' ELSE 'Email' END,
        'Replied "' || left(trim(NEW.body), 40) || '" to a campaign', 'inbound');
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_campaign_reply_stop_opt_out ON "sales-pipe".campaign_replies;
CREATE TRIGGER trg_campaign_reply_stop_opt_out
    AFTER INSERT ON "sales-pipe".campaign_replies
    FOR EACH ROW WHEN ("sales-pipe".is_stop_reply(NEW.body))
    EXECUTE FUNCTION "sales-pipe".trg_campaign_reply_stop_opt_out();

-- A lead in "Do not contact": list its email and WhatsApp number; reopening removes those
CREATE OR REPLACE FUNCTION "sales-pipe".trg_dnc_stage_opt_out()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    b record;
BEGIN
    SELECT business_name, email, whatsapp_number INTO b FROM "sales-pipe".businesses WHERE id = NEW.business_id;
    IF NEW.stage = 'Do not contact' THEN
        PERFORM "sales-pipe".add_opt_out(b.email, 'Email', 'Lead moved to Do not contact', 'stage');
        PERFORM "sales-pipe".add_opt_out(b.whatsapp_number, 'WhatsApp', 'Lead moved to Do not contact', 'stage');
    ELSIF TG_OP = 'UPDATE' AND OLD.stage = 'Do not contact'
          AND NOT EXISTS (SELECT 1 FROM "sales-pipe".opportunities o
                          WHERE o.business_id = NEW.business_id AND o.id <> NEW.id AND o.stage = 'Do not contact') THEN
        DELETE FROM "sales-pipe".opt_outs o
        WHERE o.source = 'stage'
          AND ((lower(o.channel) = 'email' AND lower(o.identifier) = lower(trim(coalesce(b.email, ''))))
            OR (lower(o.channel) = 'whatsapp' AND length(regexp_replace(coalesce(b.whatsapp_number, ''), '\D', '', 'g')) >= 7
                AND regexp_replace(o.identifier, '\D', '', 'g') = regexp_replace("sales-pipe".normalise_phone(b.whatsapp_number), '\D', '', 'g')));
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_dnc_stage_opt_out ON "sales-pipe".opportunities;
CREATE TRIGGER trg_dnc_stage_opt_out
    AFTER INSERT OR UPDATE OF stage ON "sales-pipe".opportunities
    FOR EACH ROW
    EXECUTE FUNCTION "sales-pipe".trg_dnc_stage_opt_out();

REVOKE ALL ON FUNCTION "sales-pipe".add_opt_out(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe".add_opt_out(text, text, text, text) TO service_role;

-- Backfill: STOP replies already in lead chats, then leads already in Do not contact
SELECT "sales-pipe".add_opt_out(
    CASE t.platform WHEN 'WhatsApp' THEN b.whatsapp_number WHEN 'Email' THEN b.email
                    WHEN 'Instagram' THEN b.instagram WHEN 'Facebook' THEN b.facebook WHEN 'LinkedIn' THEN b.linkedin END,
    t.platform, 'Replied "' || left(trim(m.body), 40) || '" on ' || t.platform, 'inbound')
FROM "sales-pipe".messages m
JOIN "sales-pipe".threads t ON t.id = m.thread_id
JOIN "sales-pipe".opportunities o ON o.id = t.opportunity_id
JOIN "sales-pipe".businesses b ON b.id = o.business_id
WHERE m.direction = 'inbound' AND "sales-pipe".is_stop_reply(m.body);

SELECT "sales-pipe".add_opt_out(r.from_address, CASE r.channel WHEN 'whatsapp' THEN 'WhatsApp' ELSE 'Email' END,
                                'Replied "' || left(trim(r.body), 40) || '" to a campaign', 'inbound')
FROM "sales-pipe".campaign_replies r WHERE "sales-pipe".is_stop_reply(r.body);

SELECT "sales-pipe".add_opt_out(b.email, 'Email', 'Lead moved to Do not contact', 'stage'),
       "sales-pipe".add_opt_out(b.whatsapp_number, 'WhatsApp', 'Lead moved to Do not contact', 'stage')
FROM "sales-pipe".opportunities o JOIN "sales-pipe".businesses b ON b.id = o.business_id
WHERE o.stage = 'Do not contact';

COMMIT;

NOTIFY pgrst, 'reload schema';
