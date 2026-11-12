-- ==============================================================================
-- 77_scheduled_jobs.sql
-- Scheduled jobs (pg_cron). None of them changes a stage (stages stay manual).
--
--   consultation-reminders   07:00 + 08:00 UTC  acts at 08:00 London: tells the consultant
--                                               and sales person about tomorrow's consultations
--   reply-waiting            hourly             a reply unanswered for 24 h -> the owner;
--                                               48 h -> the admins (once per reply)
--   stuck-campaign-sends     every 15 min       a send that never finishes (3 tries) is marked
--                                               failed; finished campaigns stop showing "Sending"
--   meta-template-status     every 15 min       app: re-checks Meta templates in review
--   campaign-queue-cron      every minute       app: sends the next campaign batch
--   sync-emails-cron         every minute       app: pulls new email replies
--
-- The app jobs call the app through "sales-pipe".call_app(), which reads the app
-- address and the cron secret from Supabase Vault (secrets 'sales_app_url' and
-- 'sales_cron_secret'), so no key is stored in the job list. Set them once per
-- environment with scripts/db/sync-cron.cjs. Until then the app jobs log a warning and do nothing.
-- Existing campaign-queue-cron / sync-emails-cron jobs (dev) are kept as they are.
-- Needs the pg_cron, pg_net and supabase_vault extensions.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

-- Scheduling and web calls (already on in dev; staging needs them turned on)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

BEGIN;

-- New notification types
ALTER TABLE "sales-pipe".notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE "sales-pipe".notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[
    'new_reply', 'booking_matched', 'booking_unmatched', 'needs_consultant', 'assigned_to_you',
    'upsell_due', 'unsubscribed', 'consultation_reminder', 'reply_waiting']));

-- ---------- 1. Consultation reminders ----------
CREATE OR REPLACE FUNCTION "sales-pipe".cron_consultation_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v_tomorrow date := (now() AT TIME ZONE 'Europe/London')::date + 1;
    v_count int;
BEGIN
    -- Scheduled at 07:00 and 08:00 UTC; only the run at 08:00 London time sends (summer and winter)
    IF extract(hour FROM now() AT TIME ZONE 'Europe/London') <> 8 THEN RETURN 0; END IF;

    INSERT INTO "sales-pipe".notifications (user_id, type, title, message, link)
    SELECT DISTINCT u.user_id, 'consultation_reminder',
           'Consultation tomorrow: ' || b.business_name,
           'At ' || to_char(o.consultation_at AT TIME ZONE 'Europe/London', 'HH24:MI') || ' (UK time). Open the lead to prepare.',
           '/dashboard/' || o.id
    FROM "sales-pipe".opportunities o
    JOIN "sales-pipe".businesses b ON b.id = o.business_id AND NOT b.archived AND b.off_target_at IS NULL
    CROSS JOIN LATERAL (VALUES (o.assigned_consultant_id), (o.assigned_sales_id)) u(user_id)
    WHERE o.stage = 'Consultation'
      AND (o.consultation_at AT TIME ZONE 'Europe/London')::date = v_tomorrow
      AND u.user_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "sales-pipe".notifications n
                      WHERE n.user_id = u.user_id AND n.type = 'consultation_reminder'
                        AND n.link = '/dashboard/' || o.id AND n.created_at > now() - interval '20 hours');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ---------- 2. Replies waiting for an answer ----------
CREATE OR REPLACE FUNCTION "sales-pipe".cron_reply_waiting()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v_owner int;
    v_admin int;
BEGIN
    -- 24 hours: whoever works the lead
    INSERT INTO "sales-pipe".notifications (user_id, type, title, message, link)
    SELECT coalesce(o.assigned_consultant_id, o.assigned_sales_id), 'reply_waiting',
           'Reply waiting: ' || b.business_name,
           'They replied on ' || t.platform || ' more than a day ago and haven''t had an answer.',
           '/dashboard/' || o.id || '/thread/' || t.id
    FROM "sales-pipe".threads t
    JOIN "sales-pipe".opportunities o ON o.id = t.opportunity_id
    JOIN "sales-pipe".businesses b ON b.id = o.business_id AND NOT b.archived AND b.off_target_at IS NULL
    WHERE o.stage IN ('Active', 'Interested', 'Consultation')
      AND t.status = 'Replied'
      AND t.last_inbound_at > coalesce(t.last_outbound_at, '-infinity')
      AND t.last_inbound_at < now() - interval '24 hours'
      AND coalesce(o.assigned_consultant_id, o.assigned_sales_id) IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "sales-pipe".notifications n
                      WHERE n.type = 'reply_waiting' AND n.user_id = coalesce(o.assigned_consultant_id, o.assigned_sales_id)
                        AND n.link = '/dashboard/' || o.id || '/thread/' || t.id AND n.created_at > t.last_inbound_at);
    GET DIAGNOSTICS v_owner = ROW_COUNT;

    -- 48 hours (or nobody assigned): the admins
    INSERT INTO "sales-pipe".notifications (user_id, type, title, message, link)
    SELECT p.id, 'reply_waiting',
           'Reply waiting 2+ days: ' || b.business_name,
           'They replied on ' || t.platform || ' over two days ago with no answer'
             || CASE WHEN coalesce(o.assigned_consultant_id, o.assigned_sales_id) IS NULL THEN ', and nobody is assigned.' ELSE '.' END,
           '/dashboard/' || o.id || '/thread/' || t.id
    FROM "sales-pipe".threads t
    JOIN "sales-pipe".opportunities o ON o.id = t.opportunity_id
    JOIN "sales-pipe".businesses b ON b.id = o.business_id AND NOT b.archived AND b.off_target_at IS NULL
    CROSS JOIN "sales-pipe".profiles p
    WHERE p.role = 'admin' AND p.is_active
      AND o.stage IN ('Active', 'Interested', 'Consultation')
      AND t.status = 'Replied'
      AND t.last_inbound_at > coalesce(t.last_outbound_at, '-infinity')
      AND t.last_inbound_at < now() - interval '48 hours'
      AND NOT EXISTS (SELECT 1 FROM "sales-pipe".notifications n
                      WHERE n.type = 'reply_waiting' AND n.user_id = p.id
                        AND n.link = '/dashboard/' || o.id || '/thread/' || t.id AND n.created_at > t.last_inbound_at);
    GET DIAGNOSTICS v_admin = ROW_COUNT;
    RETURN v_owner + v_admin;
END;
$$;

-- ---------- 3. Campaign sends that never finish ----------
CREATE OR REPLACE FUNCTION "sales-pipe".cron_recover_stuck_sends()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v_failed int;
BEGIN
    -- A send that crashed 3 times would otherwise go back in the queue forever
    UPDATE "sales-pipe".campaign_recipients
    SET status = 'failed', locked_at = NULL, updated_at = now(),
        error_detail = coalesce(error_detail, 'Stopped: the send didn''t finish after 3 tries.')
    WHERE status = 'sending' AND locked_at < now() - interval '15 minutes' AND attempts >= 3;
    GET DIAGNOSTICS v_failed = ROW_COUNT;

    -- Campaigns with nothing left to send are finished
    UPDATE "sales-pipe".email_campaigns c SET status = 'sent', sent_at = coalesce(c.sent_at, now()), updated_at = now()
    WHERE c.status = 'sending'
      AND NOT EXISTS (SELECT 1 FROM "sales-pipe".campaign_recipients q WHERE q.campaign_id = c.id AND q.status IN ('queued', 'sending'));
    UPDATE "sales-pipe".whatsapp_campaigns c SET status = 'sent', sent_at = coalesce(c.sent_at, now()), updated_at = now()
    WHERE c.status = 'sending'
      AND NOT EXISTS (SELECT 1 FROM "sales-pipe".campaign_recipients q WHERE q.whatsapp_campaign_id = c.id AND q.status IN ('queued', 'sending'));

    RETURN jsonb_build_object('failed', v_failed);
END;
$$;

-- ---------- App calls (address and secret from Vault) ----------
CREATE OR REPLACE FUNCTION "sales-pipe".call_app(p_path text, p_body jsonb DEFAULT '{}'::jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v_url text;
    v_secret text;
BEGIN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'sales_app_url';
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'sales_cron_secret';
    IF v_url IS NULL OR v_secret IS NULL THEN
        RAISE WARNING 'call_app: set the Vault secrets sales_app_url and sales_cron_secret';
        RETURN NULL;
    END IF;
    RETURN net.http_post(
        url := rtrim(v_url, '/') || p_path,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
        body := p_body
    );
END;
$$;

REVOKE ALL ON FUNCTION "sales-pipe".cron_consultation_reminders() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "sales-pipe".cron_reply_waiting() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "sales-pipe".cron_recover_stuck_sends() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "sales-pipe".call_app(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe".cron_consultation_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe".cron_reply_waiting() TO service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe".cron_recover_stuck_sends() TO service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe".call_app(text, jsonb) TO service_role;

-- ---------- Admin Panel copy: titles for the new types (same as migration 74 otherwise) ----------
CREATE OR REPLACE FUNCTION "sales-pipe".trg_sync_to_shared_product_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v_employee_id integer;
    v_role text;
BEGIN
    IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
    SELECT e.id INTO v_employee_id
    FROM hr.employees e
    JOIN public.user_product_access upa ON upa.employee_id = e.id
    JOIN public.products p ON p.product_id = upa.product_id AND p.code = 'sales_pipeline'
    WHERE e.auth_user_id = NEW.user_id
    LIMIT 1;
    IF v_employee_id IS NULL THEN RETURN NEW; END IF;
    SELECT role INTO v_role FROM "sales-pipe".profiles WHERE id = NEW.user_id;

    INSERT INTO shared.product_notifications (product_code, title, message, type, employee_id, is_read, created_at, metadata)
    VALUES (
        'sales_pipeline',
        CASE NEW.type
            WHEN 'new_reply' THEN 'New reply'
            WHEN 'assigned_to_you' THEN 'Assigned to you'
            WHEN 'needs_consultant' THEN 'Needs a consultant'
            WHEN 'upsell_due' THEN 'Upsell due'
            WHEN 'unsubscribed' THEN 'Opted out'
            WHEN 'booking_matched' THEN 'Booking matched'
            WHEN 'booking_unmatched' THEN 'Booking not matched'
            WHEN 'consultation_reminder' THEN 'Consultation tomorrow'
            WHEN 'reply_waiting' THEN 'Reply waiting'
            ELSE 'Sales Pipeline'
        END,
        coalesce(nullif(NEW.message, ''), NEW.title),
        CASE WHEN NEW.type IN ('assigned_to_you', 'needs_consultant', 'reply_waiting') THEN 'action_required'
             WHEN NEW.type IN ('unsubscribed', 'booking_unmatched') THEN 'warning'
             ELSE 'info' END,
        v_employee_id,
        coalesce(NEW.is_read, false),
        coalesce(NEW.created_at, now()),
        jsonb_build_object('link', NEW.link, 'channel', 'in_app', 'sales_notification_id', NEW.id,
                           'sales_user_id', NEW.user_id, 'sales_type', NEW.type, 'role', v_role)
    );
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'trg_sync_to_shared_product_notifications error: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- ---------- The schedule ----------
-- Database jobs: always (re)created. App jobs: created only when missing, so an
-- environment's existing campaign / email jobs are left exactly as they are.
DO $$
DECLARE
    j record;
BEGIN
    FOR j IN SELECT * FROM (VALUES
        ('consultation-reminders', '0 7,8 * * *',  'SELECT "sales-pipe".cron_consultation_reminders()', true),
        ('reply-waiting',          '15 * * * *',   'SELECT "sales-pipe".cron_reply_waiting()', true),
        ('stuck-campaign-sends',   '*/15 * * * *', 'SELECT "sales-pipe".cron_recover_stuck_sends()', true),
        ('meta-template-status',   '*/15 * * * *', 'SELECT "sales-pipe".call_app(''/api/cron/meta-templates'')', true),
        ('campaign-queue-cron',    '* * * * *',    'SELECT "sales-pipe".call_app(''/api/campaigns/process'')', false),
        ('sync-emails-cron',       '* * * * *',    'SELECT "sales-pipe".call_app(''/api/email/sync'', ''{"unseenOnly": true}''::jsonb)', false)
    ) v(name, schedule, command, replace) LOOP
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = j.name) THEN
            CONTINUE WHEN NOT j.replace;
            PERFORM cron.unschedule(j.name);
        END IF;
        PERFORM cron.schedule(j.name, j.schedule, j.command);
    END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
