-- ==============================================================================
-- 82_sync_dev_settings_and_grants.sql
-- Brings staging and production in line with dev:
--   * Settings 'default_business_category': type used when a lead's type matches none
--   * No public (anon) access to internal functions or the integrations table
-- Safe to run more than once.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

INSERT INTO "sales-pipe".settings (key, value, description)
SELECT 'default_business_category', '"Restaurant or cafe"'::jsonb,
       'Category used when a lead''s business type matches no category'
WHERE NOT EXISTS (SELECT 1 FROM "sales-pipe".settings WHERE key = 'default_business_category');

REVOKE EXECUTE ON FUNCTION "sales-pipe".is_stop_reply(text) FROM anon;
REVOKE EXECUTE ON FUNCTION "sales-pipe".notification_text(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION "sales-pipe".reply_intent(text) FROM anon;
REVOKE EXECUTE ON FUNCTION "sales-pipe".trg_campaign_reply_stop_opt_out() FROM anon;
REVOKE EXECUTE ON FUNCTION "sales-pipe".trg_dnc_stage_opt_out() FROM anon;
REVOKE EXECUTE ON FUNCTION "sales-pipe".trg_message_stop_opt_out() FROM anon;
REVOKE EXECUTE ON FUNCTION "sales-pipe".trg_notification_text() FROM anon;
REVOKE EXECUTE ON FUNCTION "sales-pipe".trg_sync_read_to_shared_product_notifications() FROM anon;
REVOKE EXECUTE ON FUNCTION "sales-pipe".trg_sync_to_shared_product_notifications() FROM anon;
REVOKE EXECUTE ON FUNCTION "sales-pipe".trg_won_adds_audience_client() FROM anon;

REVOKE ALL ON TABLE "sales-pipe".integrations FROM anon;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON TABLE "sales-pipe".integrations FROM authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
