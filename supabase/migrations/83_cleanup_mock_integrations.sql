-- ==============================================================================
-- 83_cleanup_mock_integrations.sql
-- Remove dummy/mock integration data seeded in migration 60:
-- - Clears fake Instagram (@selfera.official, page Selfera UK)
-- - Clears fake Facebook (Selfera UK, page ID 102938475610293)
-- - Removes fake Resend API key (re_9xK8...21mP) from email config
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

-- 1. Reset Instagram mock config if it contains the dummy seed
UPDATE "sales-pipe".integrations
SET 
    status = 'disconnected',
    account_info = 'Not configured',
    webhook_url = NULL,
    config = '{}'::jsonb,
    details = '[]'::jsonb,
    updated_at = now()
WHERE channel = 'instagram'
  AND (account_info LIKE '%@selfera.official%' OR config->>'username' = '@selfera.official');

-- 2. Reset Facebook mock config if it contains the dummy seed
UPDATE "sales-pipe".integrations
SET 
    status = 'disconnected',
    account_info = 'Not configured',
    webhook_url = NULL,
    config = '{}'::jsonb,
    details = '[]'::jsonb,
    updated_at = now()
WHERE channel = 'facebook'
  AND (account_info LIKE '%Selfera UK%' OR config->>'page_id' = '102938475610293');

-- 3. Remove fake mock Resend key from email config if present
UPDATE "sales-pipe".integrations
SET 
    config = config - 'resend_api_key',
    updated_at = now()
WHERE channel = 'email'
  AND (config->>'resend_api_key' LIKE 're_9xK8%' OR config->>'resend_api_key' LIKE 'enc:%');

COMMIT;

NOTIFY pgrst, 'reload schema';
