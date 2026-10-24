-- ==============================================================================
-- 49_email_delivery_tracking.sql
-- Email delivery tracking. When email goes out through Resend, Resend reports
-- each email's progress to /api/email/webhook: delivered, opened, clicked,
-- bounced or marked as spam. This stores it on the chat message and campaign
-- recipient sharing the email's id. Hard bounces and spam complaints also go
-- on the do-not-contact list (opt_outs), so that address is never emailed again.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. New states and timestamps
-- ------------------------------------------------------------------------------
ALTER TABLE "sales-pipe".messages DROP CONSTRAINT IF EXISTS messages_delivery_status_check;
ALTER TABLE "sales-pipe".messages ADD CONSTRAINT messages_delivery_status_check
    CHECK (delivery_status IN ('queued', 'sent', 'delivered', 'read', 'failed', 'bounced', 'complained'));
ALTER TABLE "sales-pipe".messages
    ADD COLUMN IF NOT EXISTS opened_at timestamptz,
    ADD COLUMN IF NOT EXISTS clicked_at timestamptz;

ALTER TABLE "sales-pipe".campaign_recipients DROP CONSTRAINT IF EXISTS campaign_recipients_delivery_status_check;
ALTER TABLE "sales-pipe".campaign_recipients ADD CONSTRAINT campaign_recipients_delivery_status_check
    CHECK (delivery_status IS NULL OR delivery_status IN ('sent', 'delivered', 'read', 'failed', 'bounced', 'complained'));
ALTER TABLE "sales-pipe".campaign_recipients
    ADD COLUMN IF NOT EXISTS opened_at timestamptz,
    ADD COLUMN IF NOT EXISTS clicked_at timestamptz;

-- ------------------------------------------------------------------------------
-- 2. record_email_events: called by the webhook (service role only)
--    p_events: [{ "id": "<resend email id>", "type": "delivered|opened|clicked|bounced|complained|failed|sent|delivery_delayed",
--                 "at": "<iso time>", "to": "<address>", "reason": "<text>", "permanent": true|false }]
--    Opens and clicks are recorded once (first time); a click implies an open and
--    an open implies delivery. A bounce or complaint is final.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".record_email_events(p_events jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    e record;
    v_at timestamptz;
    v_count int := 0;
    v_n int;
    v_final text;   -- bounced / complained / failed, or NULL
    v_reason text;
BEGIN
    FOR e IN
        SELECT * FROM jsonb_to_recordset(p_events)
            AS r(id text, type text, "at" text, "to" text, reason text, permanent boolean)
        WHERE r.id IS NOT NULL
    LOOP
        v_at := coalesce(nullif(e."at", '')::timestamptz, now());
        v_final := CASE e.type WHEN 'bounced' THEN 'bounced' WHEN 'complained' THEN 'complained' WHEN 'failed' THEN 'failed' END;
        v_reason := CASE e.type
            WHEN 'bounced' THEN 'Bounced' || coalesce(': ' || nullif(e.reason, ''), '')
            WHEN 'complained' THEN 'Marked as spam by the recipient'
            WHEN 'failed' THEN 'Not sent' || coalesce(': ' || nullif(e.reason, ''), '')
        END;

        IF e.type NOT IN ('delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed') THEN
            CONTINUE;  -- sent / delivery_delayed change nothing we show
        END IF;

        UPDATE "sales-pipe".messages m
        SET delivery_status = CASE
                WHEN m.delivery_status IN ('bounced', 'complained') THEN m.delivery_status
                WHEN v_final IS NOT NULL THEN v_final
                WHEN coalesce(m.delivery_status, 'sent') IN ('queued', 'sent') THEN 'delivered'
                ELSE m.delivery_status END,
            delivered_at = CASE WHEN v_final IS NULL THEN coalesce(m.delivered_at, v_at) ELSE m.delivered_at END,
            opened_at = CASE WHEN e.type IN ('opened', 'clicked') THEN coalesce(m.opened_at, v_at) ELSE m.opened_at END,
            clicked_at = CASE WHEN e.type = 'clicked' THEN coalesce(m.clicked_at, v_at) ELSE m.clicked_at END,
            error_detail = CASE WHEN v_final IS NOT NULL AND coalesce(m.delivery_status, '') NOT IN ('bounced', 'complained') THEN left(v_reason, 500) ELSE m.error_detail END
        WHERE m.external_message_id = e.id;
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_count := v_count + v_n;

        UPDATE "sales-pipe".campaign_recipients cr
        SET delivery_status = CASE
                WHEN cr.delivery_status IN ('bounced', 'complained') THEN cr.delivery_status
                WHEN v_final IS NOT NULL THEN v_final
                WHEN cr.delivery_status IS NULL OR cr.delivery_status = 'sent' THEN 'delivered'
                ELSE cr.delivery_status END,
            delivered_at = CASE WHEN v_final IS NULL THEN coalesce(cr.delivered_at, v_at) ELSE cr.delivered_at END,
            opened_at = CASE WHEN e.type IN ('opened', 'clicked') THEN coalesce(cr.opened_at, v_at) ELSE cr.opened_at END,
            clicked_at = CASE WHEN e.type = 'clicked' THEN coalesce(cr.clicked_at, v_at) ELSE cr.clicked_at END,
            -- The provider accepted it but it never arrived: show it as failed in the report
            status = CASE WHEN v_final IS NOT NULL THEN 'failed' ELSE cr.status END,
            error_detail = CASE WHEN v_final IS NOT NULL AND coalesce(cr.delivery_status, '') NOT IN ('bounced', 'complained') THEN left(v_reason, 500) ELSE cr.error_detail END,
            updated_at = now()
        WHERE cr.external_message_id = e.id AND cr.channel = 'email';
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_count := v_count + v_n;

        -- Never email an address that hard-bounced or reported us as spam again
        IF (e.type = 'bounced' AND coalesce(e.permanent, true)) OR e.type = 'complained' THEN
            INSERT INTO "sales-pipe".opt_outs (identifier, channel, reason, source)
            SELECT lower(trim(addr)), 'Email', left(v_reason, 300), CASE WHEN e.type = 'complained' THEN 'complaint' ELSE 'bounce' END
            FROM (
                SELECT coalesce(nullif(e."to", ''),
                    (SELECT cr.email FROM "sales-pipe".campaign_recipients cr WHERE cr.external_message_id = e.id LIMIT 1),
                    (SELECT b.email FROM "sales-pipe".messages m
                        JOIN "sales-pipe".threads t ON t.id = m.thread_id
                        JOIN "sales-pipe".opportunities o ON o.id = t.opportunity_id
                        JOIN "sales-pipe".businesses b ON b.id = o.business_id
                     WHERE m.external_message_id = e.id LIMIT 1)) AS addr
            ) a
            WHERE addr IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM "sales-pipe".opt_outs o
                              WHERE lower(o.identifier) = lower(trim(a.addr)) AND lower(o.channel) IN ('all', 'email'));
        END IF;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION "sales-pipe".record_email_events(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe".record_email_events(jsonb) TO service_role;

-- ------------------------------------------------------------------------------
-- 3. campaign_progress: add opened / clicked / bounced (otherwise unchanged from 48)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".campaign_progress(p_channel text, p_campaign_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = "sales-pipe", public
AS $$
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
        'failures', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'to', coalesce(email, phone), 'name', business_name, 'error', error_detail) ORDER BY updated_at DESC)
            FROM (SELECT * FROM rows WHERE status IN ('failed', 'skipped') ORDER BY updated_at DESC LIMIT 50) f
        ), '[]'::jsonb)
    );
$$;

COMMIT;
