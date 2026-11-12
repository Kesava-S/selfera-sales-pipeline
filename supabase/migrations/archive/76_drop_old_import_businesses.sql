-- ==============================================================================
-- 76_drop_old_import_businesses.sql
-- Remove the old one-argument import_businesses(jsonb). The app calls
-- import_businesses(p_rows, p_batch_id) only; the old version was still on
-- staging/production and skipped the admin + sales check from migration 68.
-- (Already gone on dev, so this is a no-op there.)
-- ==============================================================================

DROP FUNCTION IF EXISTS "sales-pipe".import_businesses(jsonb);

NOTIFY pgrst, 'reload schema';
