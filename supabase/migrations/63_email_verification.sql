-- ==============================================================================
-- 63_email_verification.sql
-- Email check result for Lead Management businesses and Client Audience customers,
-- set after a CSV import (free checks first, then QuickEmailVerification).
--   email_status:     valid | risky | invalid | disposable | unknown | NULL (not checked)
--   email_reason:     short reason (e.g. "No mail server", "Accept-all domain")
--   email_suggestion: likely correction for a typo (e.g. gmail.com)
--   email_role:       a shared inbox such as info@ or sales@
-- Changing the email clears the result, so it is checked again.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

ALTER TABLE "sales-pipe".businesses
    ADD COLUMN IF NOT EXISTS email_status text CHECK (email_status IN ('valid', 'risky', 'invalid', 'disposable', 'unknown')),
    ADD COLUMN IF NOT EXISTS email_reason text,
    ADD COLUMN IF NOT EXISTS email_suggestion text,
    ADD COLUMN IF NOT EXISTS email_role boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS email_checked_at timestamptz;

ALTER TABLE "sales-pipe".customer_leads
    ADD COLUMN IF NOT EXISTS email_status text CHECK (email_status IN ('valid', 'risky', 'invalid', 'disposable', 'unknown')),
    ADD COLUMN IF NOT EXISTS email_reason text,
    ADD COLUMN IF NOT EXISTS email_suggestion text,
    ADD COLUMN IF NOT EXISTS email_role boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS email_checked_at timestamptz;

-- Emails waiting for a check
CREATE INDEX IF NOT EXISTS idx_businesses_email_unchecked ON "sales-pipe".businesses (import_batch_id)
    WHERE email IS NOT NULL AND email_checked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_leads_email_unchecked ON "sales-pipe".customer_leads (business_id)
    WHERE email IS NOT NULL AND email_checked_at IS NULL;

CREATE OR REPLACE FUNCTION "sales-pipe".reset_email_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = "sales-pipe", public
AS $$
BEGIN
    IF NEW.email IS DISTINCT FROM OLD.email AND NEW.email_checked_at IS NOT DISTINCT FROM OLD.email_checked_at THEN
        NEW.email_status := NULL;
        NEW.email_reason := NULL;
        NEW.email_suggestion := NULL;
        NEW.email_role := false;
        NEW.email_checked_at := NULL;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION "sales-pipe".reset_email_check() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_businesses_reset_email_check ON "sales-pipe".businesses;
CREATE TRIGGER trg_businesses_reset_email_check BEFORE UPDATE OF email ON "sales-pipe".businesses
    FOR EACH ROW EXECUTE FUNCTION "sales-pipe".reset_email_check();

DROP TRIGGER IF EXISTS trg_customer_leads_reset_email_check ON "sales-pipe".customer_leads;
CREATE TRIGGER trg_customer_leads_reset_email_check BEFORE UPDATE OF email ON "sales-pipe".customer_leads
    FOR EACH ROW EXECUTE FUNCTION "sales-pipe".reset_email_check();

COMMIT;

NOTIFY pgrst, 'reload schema';
