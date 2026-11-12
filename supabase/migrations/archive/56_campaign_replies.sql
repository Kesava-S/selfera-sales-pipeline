-- ==============================================================================
-- 56_campaign_replies.sql
-- Replies to email and WhatsApp campaigns.
--   - Every reply from someone a campaign messaged (last 30 days) is kept and
--     linked to that campaign; the campaign shows a "Replied" count.
--   - Replies from senders we don't know at all are kept as "unmatched"
--     instead of being dropped.
--   - "Open in Lead Management" hands a reply over to one-to-one follow-up.
-- Campaigns stay separate: nothing here changes a lead until staff hand it over.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

ALTER TABLE "sales-pipe".campaign_recipients ADD COLUMN IF NOT EXISTS replied_at timestamptz;

CREATE TABLE IF NOT EXISTS "sales-pipe".campaign_replies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
    from_address text NOT NULL,
    subject text,
    body text NOT NULL,
    external_message_id text UNIQUE,
    received_at timestamptz NOT NULL DEFAULT now(),
    recipient_id uuid REFERENCES "sales-pipe".campaign_recipients(id) ON DELETE SET NULL,
    campaign_id uuid REFERENCES "sales-pipe".email_campaigns(id) ON DELETE SET NULL,
    whatsapp_campaign_id uuid REFERENCES "sales-pipe".whatsapp_campaigns(id) ON DELETE SET NULL,
    business_id uuid REFERENCES "sales-pipe".businesses(id) ON DELETE SET NULL,
    -- Set when it also arrived in a Lead Management chat, or after hand-over
    opportunity_id uuid REFERENCES "sales-pipe".opportunities(id) ON DELETE SET NULL,
    thread_id uuid REFERENCES "sales-pipe".threads(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_leads', 'dismissed')),
    handled_by uuid REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL,
    handled_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_campaign_replies_campaign ON "sales-pipe".campaign_replies (campaign_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_wa_campaign ON "sales-pipe".campaign_replies (whatsapp_campaign_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_status ON "sales-pipe".campaign_replies (status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_email_norm ON "sales-pipe".campaign_recipients (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_phone_norm ON "sales-pipe".campaign_recipients ("sales-pipe".normalise_phone(phone)) WHERE phone IS NOT NULL;

ALTER TABLE "sales-pipe".campaign_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_replies_read ON "sales-pipe".campaign_replies;
CREATE POLICY campaign_replies_read ON "sales-pipe".campaign_replies
    FOR SELECT TO authenticated USING ("sales-pipe".get_user_role() IN ('admin', 'sales'));
REVOKE ALL ON "sales-pipe".campaign_replies FROM PUBLIC, anon;
GRANT SELECT ON "sales-pipe".campaign_replies TO authenticated;
GRANT ALL ON "sales-pipe".campaign_replies TO service_role;

-- ------------------------------------------------------------------------------
-- 1. capture_campaign_reply: called by the inbox sync and the WhatsApp webhook
--    right after record_inbound. Returns what it did.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".capture_campaign_reply(
    p_channel text, p_from text, p_body text, p_subject text, p_external_message_id text, p_looks_like_reply boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_rec record;
    v_msg record;
    v_business uuid;
BEGIN
    IF p_external_message_id IS NOT NULL AND EXISTS (SELECT 1 FROM "sales-pipe".campaign_replies WHERE external_message_id = p_external_message_id) THEN
        RETURN 'duplicate';
    END IF;

    -- The latest campaign message we sent this person in the last 30 days
    SELECT * INTO v_rec FROM "sales-pipe".campaign_recipients r
    WHERE r.channel = p_channel AND r.status = 'sent' AND r.sent_at > now() - interval '30 days'
      AND ((p_channel = 'email' AND lower(r.email) = "sales-pipe".normalise_email(p_from))
        OR (p_channel = 'whatsapp' AND "sales-pipe".normalise_phone(r.phone) = "sales-pipe".normalise_phone(p_from)))
    ORDER BY r.sent_at DESC LIMIT 1;

    -- Did record_inbound already put it in a Lead Management chat?
    SELECT m.thread_id, t.opportunity_id INTO v_msg
    FROM "sales-pipe".messages m JOIN "sales-pipe".threads t ON t.id = m.thread_id
    WHERE p_external_message_id IS NOT NULL AND m.external_message_id = p_external_message_id
    LIMIT 1;

    IF v_rec.id IS NULL AND v_msg.thread_id IS NOT NULL THEN
        RETURN 'lead_chat_only';   -- a normal one-to-one reply, nothing to do here
    END IF;
    -- Unknown sender: keep WhatsApp messages, and emails that look like replies (not newsletters)
    IF v_rec.id IS NULL AND p_channel = 'email' AND NOT coalesce(p_looks_like_reply, false) THEN
        RETURN 'ignored';
    END IF;

    v_business := v_rec.business_id;
    IF v_business IS NULL THEN
        SELECT b.id INTO v_business FROM "sales-pipe".businesses b
        WHERE (p_channel = 'email' AND b.email_normalised = "sales-pipe".normalise_email(p_from))
           OR (p_channel = 'whatsapp' AND ("sales-pipe".normalise_phone(b.whatsapp_number) = "sales-pipe".normalise_phone(p_from)
                                           OR b.phone_normalised = "sales-pipe".normalise_phone(p_from)))
        ORDER BY b.archived, b.created_at DESC LIMIT 1;
    END IF;

    INSERT INTO "sales-pipe".campaign_replies
        (channel, from_address, subject, body, external_message_id, recipient_id, campaign_id, whatsapp_campaign_id,
         business_id, opportunity_id, thread_id, status)
    VALUES
        (p_channel, p_from, p_subject, coalesce(nullif(trim(p_body), ''), '(empty message)'), p_external_message_id, v_rec.id, v_rec.campaign_id, v_rec.whatsapp_campaign_id,
         v_business, v_msg.opportunity_id, v_msg.thread_id,
         CASE WHEN v_msg.thread_id IS NOT NULL THEN 'in_leads' ELSE 'new' END);

    IF v_rec.id IS NOT NULL THEN
        UPDATE "sales-pipe".campaign_recipients SET replied_at = coalesce(replied_at, now()) WHERE id = v_rec.id;
    END IF;
    RETURN CASE WHEN v_rec.id IS NOT NULL THEN 'campaign' ELSE 'unmatched' END;
END;
$function$;

REVOKE ALL ON FUNCTION "sales-pipe".capture_campaign_reply(text, text, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe".capture_campaign_reply(text, text, text, text, text, boolean) TO service_role;

-- ------------------------------------------------------------------------------
-- 2. open_campaign_reply_in_leads: hand a reply over to one-to-one follow-up.
--    Copies it into the business's chat for that channel and moves the lead on.
--    Returns the chat to open.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".open_campaign_reply_in_leads(p_reply_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    r record;
    v_opp record;
    v_platform text;
    v_thread uuid;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales']);
    SELECT * INTO r FROM "sales-pipe".campaign_replies WHERE id = p_reply_id FOR UPDATE;
    IF r.id IS NULL THEN RAISE EXCEPTION 'This reply was not found'; END IF;
    IF r.thread_id IS NOT NULL THEN
        UPDATE "sales-pipe".campaign_replies SET status = 'in_leads', handled_by = coalesce(handled_by, auth.uid()), handled_at = coalesce(handled_at, now()) WHERE id = r.id;
        RETURN jsonb_build_object('opportunity_id', r.opportunity_id, 'thread_id', r.thread_id);
    END IF;
    IF r.business_id IS NULL THEN
        RAISE EXCEPTION 'This sender is not in Lead Management. Add them as a business first';
    END IF;

    -- The business's most relevant pitch: open ones first, then the newest
    SELECT * INTO v_opp FROM "sales-pipe".opportunities
    WHERE business_id = r.business_id
    ORDER BY (stage IN ('Active', 'Interested', 'Consultation')) DESC, created_at DESC LIMIT 1;
    IF v_opp.id IS NULL THEN RAISE EXCEPTION 'This business has no pitch yet'; END IF;
    IF v_opp.stage = 'Needs review' THEN
        RAISE EXCEPTION 'Approve this lead in the Approval queue first, then open the reply';
    END IF;
    IF v_opp.stage = 'Do not contact' THEN
        RAISE EXCEPTION 'This business is on Do not contact. Reopen it from the lead page first';
    END IF;

    v_platform := CASE r.channel WHEN 'email' THEN 'Email' ELSE 'WhatsApp' END;
    INSERT INTO "sales-pipe".threads (opportunity_id, platform, status, step)
    VALUES (v_opp.id, v_platform, 'Not contacted', 0)
    ON CONFLICT (opportunity_id, platform) DO NOTHING;
    SELECT id INTO v_thread FROM "sales-pipe".threads WHERE opportunity_id = v_opp.id AND platform = v_platform;

    INSERT INTO "sales-pipe".messages (thread_id, direction, body, subject, send_method, external_message_id, created_at)
    VALUES (v_thread, 'inbound', r.body, r.subject, 'webhook', NULL, r.received_at);

    IF v_opp.stage IN ('Went cold', 'No response', 'Declined') THEN
        -- Closed: mark the late reply, then reopen; the reopen starts a new round around it
        UPDATE "sales-pipe".threads SET last_inbound_at = r.received_at WHERE id = v_thread;
        UPDATE "sales-pipe".opportunities SET replied_after_close_at = r.received_at WHERE id = v_opp.id;
        PERFORM "sales-pipe".set_stage(v_opp.id, 'Interested', 'Replied to a campaign', auth.uid());
    ELSE
        PERFORM "sales-pipe".discard_drafts(v_opp.id);
        UPDATE "sales-pipe".threads
        SET status = 'Replied', next_due_on = NULL, last_inbound_at = greatest(coalesce(last_inbound_at, r.received_at), r.received_at), paused_reason = NULL
        WHERE id = v_thread;
        UPDATE "sales-pipe".threads
        SET status = 'Paused', paused_reason = 'Replied on ' || v_platform, next_due_on = NULL
        WHERE opportunity_id = v_opp.id AND id <> v_thread AND status IN ('Not contacted', 'Awaiting reply');
        IF v_opp.stage = 'Active' THEN
            PERFORM "sales-pipe".set_stage(v_opp.id, 'Interested', 'Replied to a campaign', auth.uid());
        END IF;
        PERFORM "sales-pipe".generate_draft(v_thread, 'Reply');
    END IF;

    UPDATE "sales-pipe".campaign_replies
    SET status = 'in_leads', opportunity_id = v_opp.id, thread_id = v_thread, handled_by = auth.uid(), handled_at = now()
    WHERE id = r.id;
    RETURN jsonb_build_object('opportunity_id', v_opp.id, 'thread_id', v_thread);
END;
$function$;

CREATE OR REPLACE FUNCTION "sales-pipe".dismiss_campaign_reply(p_reply_id uuid, p_undo boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales']);
    UPDATE "sales-pipe".campaign_replies
    SET status = CASE WHEN p_undo THEN 'new' ELSE 'dismissed' END,
        handled_by = CASE WHEN p_undo THEN NULL ELSE auth.uid() END,
        handled_at = CASE WHEN p_undo THEN NULL ELSE now() END
    WHERE id = p_reply_id AND status <> 'in_leads';
END;
$function$;

REVOKE ALL ON FUNCTION "sales-pipe".open_campaign_reply_in_leads(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION "sales-pipe".dismiss_campaign_reply(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "sales-pipe".open_campaign_reply_in_leads(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe".dismiss_campaign_reply(uuid, boolean) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. campaign_progress: same as live, plus "replied"
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".campaign_progress(p_channel text, p_campaign_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'sales-pipe', 'public'
AS $function$
    WITH rows AS (
        SELECT * FROM "sales-pipe".campaign_recipients
        WHERE (p_channel = 'email' AND campaign_id = p_campaign_id)
           OR (p_channel = 'whatsapp' AND whatsapp_campaign_id = p_campaign_id)
    )
    SELECT jsonb_build_object(
        'status', CASE WHEN p_channel = 'email'
            THEN (SELECT status FROM "sales-pipe".email_campaigns WHERE id = p_campaign_id)
            ELSE (SELECT status FROM "sales-pipe".whatsapp_campaigns WHERE id = p_campaign_id) END,
        'total', (SELECT count(*) FROM rows WHERE status <> 'skipped'),
        'queued', (SELECT count(*) FROM rows WHERE status = 'queued'),
        'sending', (SELECT count(*) FROM rows WHERE status = 'sending'),
        'sent', (SELECT count(*) FROM rows WHERE status = 'sent'),
        'failed', (SELECT count(*) FROM rows WHERE status = 'failed'),
        'skipped', (SELECT count(*) FROM rows WHERE status = 'skipped'),
        'simulated', (SELECT count(*) FROM rows WHERE status = 'sent' AND simulated),
        'retrying', (SELECT count(*) FROM rows WHERE status = 'queued' AND attempts > 0),
        'delivered', (SELECT count(*) FROM rows WHERE delivery_status IN ('delivered', 'read')),
        'read', (SELECT count(*) FROM rows WHERE delivery_status = 'read'),
        'opened', (SELECT count(*) FROM rows WHERE opened_at IS NOT NULL),
        'clicked', (SELECT count(*) FROM rows WHERE clicked_at IS NOT NULL),
        'bounced', (SELECT count(*) FROM rows WHERE delivery_status IN ('bounced', 'complained')),
        'replied', (SELECT count(*) FROM rows WHERE replied_at IS NOT NULL),
        'failures', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'to', coalesce(email, phone), 'name', business_name, 'error', error_detail) ORDER BY updated_at DESC)
            FROM (SELECT * FROM rows WHERE status IN ('failed', 'skipped') ORDER BY updated_at DESC LIMIT 50) f
        ), '[]'::jsonb)
    );
$function$;

COMMIT;
