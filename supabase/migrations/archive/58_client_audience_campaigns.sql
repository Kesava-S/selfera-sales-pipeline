-- ==============================================================================
-- 58_client_audience_campaigns.sql
-- Client Audience campaigns (beta) and audience data tools.
--   - A client's audience can be messaged only when the business is Won and a
--     data-processing agreement (DPA) is recorded. If the business stops being
--     Won, unsent messages wait (paused) until it is Won again.
--   - Campaigns reuse the email / WhatsApp send queue, tracking and reports.
--     They are ordinary campaign rows marked with audience_business_id, so the
--     business campaign pages leave them out.
--   - Who gets it: Ready customers from approved imports (or added by hand),
--     filtered by tags, last visit, birthday month, country or mobile, and not
--     messaged within the "Audience gap" days from Settings.
--   - Opt-outs are per client: the customer is marked Do not contact for that
--     client only.
--   - Imports wait for an admin's approval; an import can be undone; all of a
--     client's customers can be deleted; exports are logged.
--   - WhatsApp delivery results mark numbers "On WhatsApp" / "Not on WhatsApp".
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Columns and the client settings table
-- ------------------------------------------------------------------------------
ALTER TABLE "sales-pipe".email_campaigns
    ADD COLUMN IF NOT EXISTS audience_business_id uuid REFERENCES "sales-pipe".businesses(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS audience_filter jsonb;
ALTER TABLE "sales-pipe".whatsapp_campaigns
    ADD COLUMN IF NOT EXISTS audience_business_id uuid REFERENCES "sales-pipe".businesses(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS audience_filter jsonb;
CREATE INDEX IF NOT EXISTS idx_email_campaigns_audience ON "sales-pipe".email_campaigns (audience_business_id) WHERE audience_business_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_audience ON "sales-pipe".whatsapp_campaigns (audience_business_id) WHERE audience_business_id IS NOT NULL;

ALTER TABLE "sales-pipe".campaign_recipients
    ADD COLUMN IF NOT EXISTS customer_lead_id uuid REFERENCES "sales-pipe".customer_leads(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS opted_out_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_customer ON "sales-pipe".campaign_recipients (customer_lead_id, created_at DESC) WHERE customer_lead_id IS NOT NULL;

ALTER TABLE "sales-pipe".customer_import_batches
    ADD COLUMN IF NOT EXISTS approved_at timestamptz,
    ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "sales-pipe".audience_clients (
    business_id uuid PRIMARY KEY REFERENCES "sales-pipe".businesses(id) ON DELETE CASCADE,
    dpa_signed_on date,
    sender_name text,          -- shown as the email sender; the business name when empty
    reply_to text CHECK (reply_to IS NULL OR reply_to ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    updated_by uuid REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "sales-pipe".audience_clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audience_clients_read ON "sales-pipe".audience_clients;
CREATE POLICY audience_clients_read ON "sales-pipe".audience_clients
    FOR SELECT TO authenticated USING ("sales-pipe".get_user_role() IN ('admin', 'sales'));
REVOKE ALL ON "sales-pipe".audience_clients FROM PUBLIC, anon;
GRANT SELECT ON "sales-pipe".audience_clients TO authenticated;
GRANT ALL ON "sales-pipe".audience_clients TO service_role;

-- ------------------------------------------------------------------------------
-- 2. Unlocked = Won + DPA. Pausing holds unsent messages back.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".audience_unlocked(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
    SELECT EXISTS (SELECT 1 FROM "sales-pipe".opportunities WHERE business_id = p_business_id AND stage = 'Won')
       AND EXISTS (SELECT 1 FROM "sales-pipe".audience_clients WHERE business_id = p_business_id AND dpa_signed_on IS NOT NULL);
$function$;

CREATE OR REPLACE FUNCTION "sales-pipe".audience_sync_pause(p_business_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_ok boolean := "sales-pipe".audience_unlocked(p_business_id);
BEGIN
    UPDATE "sales-pipe".campaign_recipients r
    SET next_attempt_at = CASE WHEN v_ok THEN now() ELSE 'infinity'::timestamptz END, updated_at = now()
    WHERE r.status = 'queued'
      AND (CASE WHEN v_ok THEN r.next_attempt_at = 'infinity'::timestamptz ELSE r.next_attempt_at <> 'infinity'::timestamptz END)
      AND (r.campaign_id IN (SELECT id FROM "sales-pipe".email_campaigns WHERE audience_business_id = p_business_id)
        OR r.whatsapp_campaign_id IN (SELECT id FROM "sales-pipe".whatsapp_campaigns WHERE audience_business_id = p_business_id));
END;
$function$;

CREATE OR REPLACE FUNCTION "sales-pipe".trg_audience_won_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    PERFORM "sales-pipe".audience_sync_pause(NEW.business_id);
    RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_audience_won_change ON "sales-pipe".opportunities;
CREATE TRIGGER trg_audience_won_change
    AFTER UPDATE OF stage ON "sales-pipe".opportunities
    FOR EACH ROW
    WHEN ((OLD.stage = 'Won') IS DISTINCT FROM (NEW.stage = 'Won'))
    EXECUTE FUNCTION "sales-pipe".trg_audience_won_change();

-- Admins record the DPA and how emails are signed
CREATE OR REPLACE FUNCTION "sales-pipe".set_audience_client(p_business_id uuid, p_dpa_signed_on date, p_sender_name text, p_reply_to text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin']);
    IF p_dpa_signed_on > CURRENT_DATE THEN RAISE EXCEPTION 'The signing date can''t be in the future'; END IF;
    INSERT INTO "sales-pipe".audience_clients (business_id, dpa_signed_on, sender_name, reply_to, updated_by, updated_at)
    VALUES (p_business_id, p_dpa_signed_on, nullif(trim(p_sender_name), ''), nullif(lower(trim(p_reply_to)), ''), auth.uid(), now())
    ON CONFLICT (business_id) DO UPDATE
    SET dpa_signed_on = EXCLUDED.dpa_signed_on, sender_name = EXCLUDED.sender_name, reply_to = EXCLUDED.reply_to,
        updated_by = EXCLUDED.updated_by, updated_at = now();
    INSERT INTO "sales-pipe".user_logs (user_id, user_name, action, entity_type, entity_id, details)
    SELECT auth.uid()::text, p.full_name, 'audience_client_updated', 'business', p_business_id::text,
           jsonb_build_object('dpa_signed_on', p_dpa_signed_on, 'sender_name', p_sender_name, 'reply_to', p_reply_to)
    FROM (SELECT 1) one LEFT JOIN "sales-pipe".profiles p ON p.id = auth.uid();
    PERFORM "sales-pipe".audience_sync_pause(p_business_id);
END;
$function$;

-- ------------------------------------------------------------------------------
-- 3. Who a campaign goes to, and why others are left out
--    p_filter: { tags: [], birthday_months: [], country, visited_within_days,
--                not_visited_days, mobile_only }
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".audience_targets(p_business_id uuid, p_channel text, p_filter jsonb)
RETURNS TABLE (customer_id uuid, email text, phone text, first_name text, skip_reason text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
    WITH f AS (SELECT coalesce(p_filter, '{}'::jsonb) AS j),
    gap AS (SELECT coalesce((SELECT days_delay FROM "sales-pipe".cadence_rules WHERE step_name = 'Audience gap'), 14) AS days),
    base AS (
        SELECT c.*, b.approved_at,
               CASE WHEN p_channel = 'email' THEN c.email
                    WHEN c.phone_type = 'mobile' THEN c.phone_e164
                    WHEN c.phone2_type = 'mobile' THEN c.phone2_e164
                    WHEN c.phone_type = 'mobile_or_landline' THEN c.phone_e164
                    WHEN c.phone2_type = 'mobile_or_landline' THEN c.phone2_e164 END AS addr
        FROM "sales-pipe".customer_leads c
        LEFT JOIN "sales-pipe".customer_import_batches b ON b.id = c.import_batch_id, f
        WHERE c.business_id = p_business_id
          AND (coalesce(jsonb_array_length(f.j->'tags'), 0) = 0
               OR c.tags && ARRAY(SELECT jsonb_array_elements_text(f.j->'tags')))
          AND (coalesce(jsonb_array_length(f.j->'birthday_months'), 0) = 0
               OR c.birthday_month = ANY (ARRAY(SELECT (jsonb_array_elements_text(f.j->'birthday_months'))::int)))
          AND (nullif(f.j->>'country', '') IS NULL OR c.country = f.j->>'country')
          AND (nullif(f.j->>'visited_within_days', '') IS NULL OR c.last_purchase_on >= CURRENT_DATE - (f.j->>'visited_within_days')::int)
          AND (nullif(f.j->>'not_visited_days', '') IS NULL OR c.last_purchase_on < CURRENT_DATE - (f.j->>'not_visited_days')::int)
          AND (NOT coalesce((f.j->>'mobile_only')::boolean, false) OR c.phone_type = 'mobile' OR c.phone2_type = 'mobile')
    )
    SELECT base.id, CASE WHEN p_channel = 'email' THEN base.addr END, CASE WHEN p_channel = 'whatsapp' THEN base.addr END, base.first_name,
           CASE
               WHEN base.do_not_contact THEN 'Opted out'
               WHEN NOT base.is_ready THEN 'Missing data'
               WHEN base.import_batch_id IS NOT NULL AND base.approved_at IS NULL THEN 'Import not approved yet'
               WHEN base.addr IS NULL THEN CASE WHEN p_channel = 'email' THEN 'No email' ELSE 'No mobile number' END
               WHEN p_channel = 'whatsapp' AND base.whatsapp_status = 'not_on_whatsapp' THEN 'Not on WhatsApp'
               WHEN EXISTS (SELECT 1 FROM "sales-pipe".campaign_recipients r, gap
                            WHERE r.customer_lead_id = base.id AND r.status IN ('queued', 'sending', 'sent')
                              AND coalesce(r.sent_at, r.created_at) > now() - make_interval(days => gap.days))
                   THEN 'Messaged in the last ' || (SELECT days FROM gap) || ' days'
           END
    FROM base;
$function$;

CREATE OR REPLACE FUNCTION "sales-pipe".audience_preview(p_business_id uuid, p_channel text, p_filter jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales']);
    RETURN (
        SELECT jsonb_build_object(
            'send', count(*) FILTER (WHERE skip_reason IS NULL),
            'skipped', coalesce((SELECT jsonb_object_agg(reason, n) FROM (
                SELECT skip_reason AS reason, count(*) AS n FROM "sales-pipe".audience_targets(p_business_id, p_channel, p_filter)
                WHERE skip_reason IS NOT NULL GROUP BY 1) s), '{}'::jsonb))
        FROM "sales-pipe".audience_targets(p_business_id, p_channel, p_filter)
    );
END;
$function$;

-- ------------------------------------------------------------------------------
-- 4. Launch: queue the audience, then the normal worker sends it
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".enqueue_audience_campaign(p_channel text, p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_business uuid;
    v_filter jsonb;
    v_status text;
    v_client text;
    v_queued int;
    v_skipped int;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales']);
    IF p_channel = 'email' THEN
        SELECT audience_business_id, audience_filter, status INTO v_business, v_filter, v_status
        FROM "sales-pipe".email_campaigns WHERE id = p_campaign_id FOR UPDATE;
    ELSIF p_channel = 'whatsapp' THEN
        SELECT audience_business_id, audience_filter, status INTO v_business, v_filter, v_status
        FROM "sales-pipe".whatsapp_campaigns WHERE id = p_campaign_id FOR UPDATE;
    ELSE
        RAISE EXCEPTION 'Unknown campaign channel: %', p_channel;
    END IF;
    IF v_business IS NULL THEN RAISE EXCEPTION 'Campaign not found.'; END IF;
    IF v_status IN ('sending', 'sent') THEN RAISE EXCEPTION 'This campaign has already been launched.'; END IF;
    IF NOT "sales-pipe".audience_unlocked(v_business) THEN
        RAISE EXCEPTION 'Campaigns unlock when the business is Won and its data-processing agreement is recorded.';
    END IF;
    SELECT coalesce(a.sender_name, b.business_name) INTO v_client
    FROM "sales-pipe".businesses b LEFT JOIN "sales-pipe".audience_clients a ON a.business_id = b.id WHERE b.id = v_business;

    WITH ins AS (
        INSERT INTO "sales-pipe".campaign_recipients
            (channel, campaign_id, whatsapp_campaign_id, customer_lead_id, email, phone, business_name, contact_name, status, error_detail)
        SELECT p_channel,
               CASE WHEN p_channel = 'email' THEN p_campaign_id END,
               CASE WHEN p_channel = 'whatsapp' THEN p_campaign_id END,
               t.customer_id, t.email, t.phone, v_client, t.first_name,
               CASE WHEN t.skip_reason IS NULL THEN 'queued' ELSE 'skipped' END, t.skip_reason
        FROM "sales-pipe".audience_targets(v_business, p_channel, v_filter) t
        -- Customers without an address are left out entirely; everyone else is listed
        WHERE t.skip_reason IS NULL OR t.skip_reason NOT IN ('No email', 'No mobile number', 'Missing data')
        RETURNING status
    )
    SELECT count(*) FILTER (WHERE status = 'queued'), count(*) FILTER (WHERE status = 'skipped') INTO v_queued, v_skipped FROM ins;

    IF v_queued = 0 THEN RAISE EXCEPTION 'Nobody in this audience can be messaged right now.'; END IF;

    IF p_channel = 'email' THEN
        UPDATE "sales-pipe".email_campaigns SET status = 'sending', recipient_count = v_queued, sent_at = NULL, updated_at = now() WHERE id = p_campaign_id;
    ELSE
        UPDATE "sales-pipe".whatsapp_campaigns SET status = 'sending', recipient_count = v_queued, sent_at = NULL, updated_at = now() WHERE id = p_campaign_id;
    END IF;
    RETURN jsonb_build_object('queued', v_queued, 'skipped', v_skipped, 'removed', 0);
END;
$function$;

-- ------------------------------------------------------------------------------
-- 5. Opt-outs per client
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".record_audience_opt_out(p_customer_id uuid, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_client text;
    v_already boolean;
BEGIN
    SELECT coalesce(a.sender_name, b.business_name), c.do_not_contact INTO v_client, v_already
    FROM "sales-pipe".customer_leads c
    JOIN "sales-pipe".businesses b ON b.id = c.business_id
    LEFT JOIN "sales-pipe".audience_clients a ON a.business_id = c.business_id
    WHERE c.id = p_customer_id AND lower(c.email) = lower(trim(p_email));
    IF v_client IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
    IF NOT v_already THEN
        UPDATE "sales-pipe".customer_leads
        SET do_not_contact = true, do_not_contact_at = now(), do_not_contact_reason = 'Opted out using the link in an email'
        WHERE id = p_customer_id;
        UPDATE "sales-pipe".campaign_recipients SET opted_out_at = now()
        WHERE id = (SELECT id FROM "sales-pipe".campaign_recipients WHERE customer_lead_id = p_customer_id AND status = 'sent'
                    ORDER BY sent_at DESC LIMIT 1);
    END IF;
    RETURN jsonb_build_object('client', v_client, 'already', v_already);
END;
$function$;

CREATE OR REPLACE FUNCTION "sales-pipe".audience_opt_out_status(p_customer_id uuid, p_email text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
    SELECT jsonb_build_object('client', coalesce(a.sender_name, b.business_name), 'opted_out', c.do_not_contact)
    FROM "sales-pipe".customer_leads c
    JOIN "sales-pipe".businesses b ON b.id = c.business_id
    LEFT JOIN "sales-pipe".audience_clients a ON a.business_id = c.business_id
    WHERE c.id = p_customer_id AND lower(c.email) = lower(trim(p_email));
$function$;

-- Replies to audience campaigns: count only (and STOP / OPT OUT)
CREATE OR REPLACE FUNCTION "sales-pipe".capture_campaign_reply(p_channel text, p_from text, p_body text, p_subject text, p_external_message_id text, p_looks_like_reply boolean)
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

    -- Client Audience campaigns: count the reply, honour an opt-out, keep nothing else
    IF v_rec.customer_lead_id IS NOT NULL THEN
        UPDATE "sales-pipe".campaign_recipients SET replied_at = coalesce(replied_at, now()) WHERE id = v_rec.id;
        IF upper(regexp_replace(trim(coalesce(p_body, '')), '[.!]+$', '')) IN ('STOP', 'UNSUBSCRIBE', 'OPT OUT', 'OPT-OUT', 'OPTOUT') THEN
            UPDATE "sales-pipe".customer_leads
            SET do_not_contact = true, do_not_contact_at = now(),
                do_not_contact_reason = 'Replied "' || trim(p_body) || '" to a campaign'
            WHERE id = v_rec.customer_lead_id AND NOT do_not_contact;
            UPDATE "sales-pipe".campaign_recipients SET opted_out_at = coalesce(opted_out_at, now()) WHERE id = v_rec.id;
        END IF;
        RETURN 'audience';
    END IF;

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

-- Reports: + opted out
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
        'opted_out', (SELECT count(*) FROM rows WHERE opted_out_at IS NOT NULL),
        'failures', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'to', coalesce(email, phone), 'name', business_name, 'error', error_detail) ORDER BY updated_at DESC)
            FROM (SELECT * FROM rows WHERE status IN ('failed', 'skipped') ORDER BY updated_at DESC LIMIT 50) f
        ), '[]'::jsonb)
    );
$function$;

-- ------------------------------------------------------------------------------
-- 6. WhatsApp delivery results mark the number
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".trg_audience_whatsapp_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    IF NEW.delivery_status IN ('delivered', 'read') THEN
        UPDATE "sales-pipe".customer_leads SET whatsapp_status = 'confirmed'
        WHERE id = NEW.customer_lead_id AND whatsapp_status <> 'confirmed';
    ELSIF (NEW.delivery_status = 'failed' OR NEW.status = 'failed')
          AND coalesce(NEW.error_detail, '') ~* '(131026|not a whatsapp|not a valid whatsapp|isn''t on whatsapp|not on whatsapp)' THEN
        UPDATE "sales-pipe".customer_leads SET whatsapp_status = 'not_on_whatsapp'
        WHERE id = NEW.customer_lead_id AND whatsapp_status <> 'not_on_whatsapp';
    END IF;
    RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_audience_whatsapp_result ON "sales-pipe".campaign_recipients;
CREATE TRIGGER trg_audience_whatsapp_result
    AFTER UPDATE OF delivery_status, status, error_detail ON "sales-pipe".campaign_recipients
    FOR EACH ROW
    WHEN (NEW.customer_lead_id IS NOT NULL AND NEW.channel = 'whatsapp')
    EXECUTE FUNCTION "sales-pipe".trg_audience_whatsapp_result();

-- ------------------------------------------------------------------------------
-- 7. Audience data: approve / undo an import, delete everything, log exports
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".audience_log(p_action text, p_business_id uuid, p_details jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
    INSERT INTO "sales-pipe".user_logs (user_id, user_name, action, entity_type, entity_id, details)
    SELECT auth.uid()::text, p.full_name, p_action, 'business', p_business_id::text, p_details
    FROM (SELECT 1) one LEFT JOIN "sales-pipe".profiles p ON p.id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION "sales-pipe".approve_customer_import(p_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    b record;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin']);
    UPDATE "sales-pipe".customer_import_batches SET approved_at = now(), approved_by = auth.uid()
    WHERE id = p_batch_id AND approved_at IS NULL RETURNING * INTO b;
    IF b.id IS NULL THEN RAISE EXCEPTION 'This import was not found or is already approved'; END IF;
    PERFORM "sales-pipe".audience_log('audience_import_approved', b.business_id,
        jsonb_build_object('batch_id', b.id, 'file_name', b.file_name, 'customers', (SELECT count(*) FROM "sales-pipe".customer_leads WHERE import_batch_id = b.id)));
END;
$function$;

CREATE OR REPLACE FUNCTION "sales-pipe".undo_customer_import(p_batch_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    b record;
    n int;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales']);
    SELECT * INTO b FROM "sales-pipe".customer_import_batches WHERE id = p_batch_id;
    IF b.id IS NULL THEN RAISE EXCEPTION 'This import was not found'; END IF;
    IF "sales-pipe".get_user_role() <> 'admin' AND b.created_by IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Only an admin or the person who imported it can undo an import';
    END IF;
    -- Customers this file added (customers it only updated stay)
    DELETE FROM "sales-pipe".customer_leads WHERE import_batch_id = b.id;
    GET DIAGNOSTICS n = ROW_COUNT;
    DELETE FROM "sales-pipe".customer_import_batches WHERE id = b.id;
    PERFORM "sales-pipe".audience_log('audience_import_undone', b.business_id, jsonb_build_object('file_name', b.file_name, 'removed', n));
    RETURN n;
END;
$function$;

CREATE OR REPLACE FUNCTION "sales-pipe".delete_audience(p_business_id uuid, p_confirm_name text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_name text;
    n int;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin']);
    SELECT business_name INTO v_name FROM "sales-pipe".businesses WHERE id = p_business_id;
    IF v_name IS NULL THEN RAISE EXCEPTION 'This business was not found'; END IF;
    IF lower(trim(coalesce(p_confirm_name, ''))) <> lower(trim(v_name)) THEN
        RAISE EXCEPTION 'Type the business name exactly to confirm';
    END IF;
    DELETE FROM "sales-pipe".customer_leads WHERE business_id = p_business_id;
    GET DIAGNOSTICS n = ROW_COUNT;
    DELETE FROM "sales-pipe".customer_import_batches WHERE business_id = p_business_id;
    PERFORM "sales-pipe".audience_log('audience_deleted', p_business_id, jsonb_build_object('removed', n));
    RETURN n;
END;
$function$;

CREATE OR REPLACE FUNCTION "sales-pipe".log_audience_export(p_business_id uuid, p_rows int, p_filters jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin']);
    PERFORM "sales-pipe".audience_log('audience_exported', p_business_id, jsonb_build_object('rows', p_rows, 'filters', p_filters));
END;
$function$;

-- ------------------------------------------------------------------------------
-- 8. Access
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION "sales-pipe".audience_sync_pause(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "sales-pipe".trg_audience_won_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "sales-pipe".trg_audience_whatsapp_result() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "sales-pipe".audience_targets(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "sales-pipe".audience_log(text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "sales-pipe".record_audience_opt_out(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "sales-pipe".audience_opt_out_status(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe".record_audience_opt_out(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe".audience_opt_out_status(uuid, text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe".set_audience_client(uuid, date, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION "sales-pipe".audience_preview(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION "sales-pipe".enqueue_audience_campaign(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION "sales-pipe".approve_customer_import(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION "sales-pipe".undo_customer_import(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION "sales-pipe".delete_audience(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION "sales-pipe".log_audience_export(uuid, int, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "sales-pipe".audience_unlocked(uuid) TO authenticated, service_role;

COMMIT;
