-- ==============================================================================
-- 48_whatsapp_delivery_status.sql
-- WhatsApp delivery and read tracking. Meta reports each message's progress
-- (sent -> delivered -> read, or failed) to /api/whatsapp/webhook; this stores
-- it on the chat message and the campaign recipient that share its message id.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Chat messages: delivered / read
-- ------------------------------------------------------------------------------
ALTER TABLE "sales-pipe".messages DROP CONSTRAINT IF EXISTS messages_delivery_status_check;
ALTER TABLE "sales-pipe".messages ADD CONSTRAINT messages_delivery_status_check
    CHECK (delivery_status IN ('queued', 'sent', 'delivered', 'read', 'failed'));

ALTER TABLE "sales-pipe".messages
    ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
    ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- ------------------------------------------------------------------------------
-- 2. Campaign recipients: what happened after the send
--    (status stays the queue's own state; delivery_status is Meta's report)
-- ------------------------------------------------------------------------------
ALTER TABLE "sales-pipe".campaign_recipients
    ADD COLUMN IF NOT EXISTS delivery_status text,
    ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
    ADD COLUMN IF NOT EXISTS read_at timestamptz;

ALTER TABLE "sales-pipe".campaign_recipients DROP CONSTRAINT IF EXISTS campaign_recipients_delivery_status_check;
ALTER TABLE "sales-pipe".campaign_recipients ADD CONSTRAINT campaign_recipients_delivery_status_check
    CHECK (delivery_status IS NULL OR delivery_status IN ('sent', 'delivered', 'read', 'failed'));

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_external
    ON "sales-pipe".campaign_recipients (external_message_id) WHERE external_message_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 3. record_whatsapp_status: called by the webhook (service role only)
--    p_statuses: [{ "id": "<wamid>", "status": "sent|delivered|read|failed",
--                   "timestamp": <unix seconds>, "error": "<text>" }]
--    Meta can send updates out of order or twice, so a status only ever moves
--    forward (sent < delivered < read); failed only applies before delivery.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".record_whatsapp_status(p_statuses jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v_count int := 0;
    v_n int;
BEGIN
    WITH s AS (
        SELECT DISTINCT ON (r.id, r.status)
            r.id, r.status, coalesce(to_timestamp(nullif(r."timestamp", '')::bigint), now()) AS at, left(r.error, 500) AS error,
            CASE r.status WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END AS rank
        FROM jsonb_to_recordset(p_statuses) AS r(id text, status text, "timestamp" text, error text)
        WHERE r.id IS NOT NULL AND r.status IN ('sent', 'delivered', 'read', 'failed')
    ), best AS (
        -- Several updates for one message in a single call: keep the furthest along
        SELECT DISTINCT ON (id) * FROM s ORDER BY id, rank DESC, at DESC
    )
    UPDATE "sales-pipe".messages m
    SET delivery_status = CASE
            WHEN b.status = 'failed' THEN CASE WHEN m.delivery_status IN ('delivered', 'read') THEN m.delivery_status ELSE 'failed' END
            WHEN b.rank > CASE m.delivery_status WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END THEN b.status
            ELSE m.delivery_status END,
        delivered_at = CASE WHEN b.status IN ('delivered', 'read') THEN coalesce(m.delivered_at, b.at) ELSE m.delivered_at END,
        read_at = CASE WHEN b.status = 'read' THEN coalesce(m.read_at, b.at) ELSE m.read_at END,
        error_detail = CASE WHEN b.status = 'failed' AND coalesce(m.delivery_status, '') NOT IN ('delivered', 'read') THEN coalesce(b.error, 'Not delivered') ELSE m.error_detail END
    FROM best b
    WHERE m.external_message_id = b.id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_count := v_count + v_n;

    WITH s AS (
        SELECT DISTINCT ON (r.id, r.status)
            r.id, r.status, coalesce(to_timestamp(nullif(r."timestamp", '')::bigint), now()) AS at, left(r.error, 500) AS error,
            CASE r.status WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END AS rank
        FROM jsonb_to_recordset(p_statuses) AS r(id text, status text, "timestamp" text, error text)
        WHERE r.id IS NOT NULL AND r.status IN ('sent', 'delivered', 'read', 'failed')
    ), best AS (
        SELECT DISTINCT ON (id) * FROM s ORDER BY id, rank DESC, at DESC
    )
    UPDATE "sales-pipe".campaign_recipients cr
    SET delivery_status = CASE
            WHEN b.status = 'failed' THEN CASE WHEN cr.delivery_status IN ('delivered', 'read') THEN cr.delivery_status ELSE 'failed' END
            WHEN b.rank > CASE cr.delivery_status WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END THEN b.status
            ELSE cr.delivery_status END,
        delivered_at = CASE WHEN b.status IN ('delivered', 'read') THEN coalesce(cr.delivered_at, b.at) ELSE cr.delivered_at END,
        read_at = CASE WHEN b.status = 'read' THEN coalesce(cr.read_at, b.at) ELSE cr.read_at END,
        -- Meta accepted it but couldn't deliver it: show it as failed so it can be retried
        status = CASE WHEN b.status = 'failed' AND coalesce(cr.delivery_status, '') NOT IN ('delivered', 'read') THEN 'failed' ELSE cr.status END,
        error_detail = CASE WHEN b.status = 'failed' AND coalesce(cr.delivery_status, '') NOT IN ('delivered', 'read') THEN coalesce(b.error, 'Not delivered') ELSE cr.error_detail END,
        updated_at = now()
    FROM best b
    WHERE cr.external_message_id = b.id AND cr.channel = 'whatsapp';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_count := v_count + v_n;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION "sales-pipe".record_whatsapp_status(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe".record_whatsapp_status(jsonb) TO service_role;

-- ------------------------------------------------------------------------------
-- 4. campaign_progress: add delivered / read counts (otherwise unchanged from 47)
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
        'failures', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'to', coalesce(email, phone), 'name', business_name, 'error', error_detail) ORDER BY updated_at DESC)
            FROM (SELECT * FROM rows WHERE status IN ('failed', 'skipped') ORDER BY updated_at DESC LIMIT 50) f
        ), '[]'::jsonb)
    );
$$;

COMMIT;
