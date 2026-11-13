-- ==============================================================================
-- 78_phone_numbers_any_country.sql
-- Phone numbers from any country. The app checks numbers with libphonenumber-js
-- and stores them in international form (+<country code><number>). Nothing about
-- countries is fixed in code or here:
--   * Settings key 'phone_defaults': the country used for numbers written without
--     a country code, and the countries listed first in phone pickers.
--   * normalise_phone(): tidies a number for matching only (no country rules).
--   * customer_leads.country: the two-letter code read from the number (or empty).
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

-- Phone defaults (edit in Settings; calling_code is used only to tidy old numbers below)
INSERT INTO "sales-pipe".settings (key, value, description)
SELECT 'phone_defaults', '{"country": "GB", "calling_code": "44", "first": ["GB", "IN"]}'::jsonb,
       'Phone numbers: country used when a number has no country code, and countries listed first in pickers'
WHERE NOT EXISTS (SELECT 1 FROM "sales-pipe".settings WHERE key = 'phone_defaults');

-- Matching only: digits with a leading +. 00 becomes +; digits that already start
-- with a country code (as WhatsApp sends them) get a +. No country is assumed.
CREATE OR REPLACE FUNCTION "sales-pipe".normalise_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    clean text;
BEGIN
    IF p_phone IS NULL OR trim(p_phone) = '' THEN RETURN NULL; END IF;
    clean := regexp_replace(p_phone, '[^\d+]', '', 'g');
    IF clean = '' THEN RETURN NULL; END IF;
    IF clean LIKE '00%' THEN
        clean := '+' || substr(clean, 3);
    ELSIF clean NOT LIKE '+%' AND clean ~ '^[1-9]' THEN
        clean := '+' || clean;
    END IF;
    RETURN clean;
END;
$$;

-- One-time tidy: numbers saved the national way (leading 0) get the default country code
UPDATE "sales-pipe".businesses b
SET whatsapp_number = '+' || s.cc || substr(regexp_replace(b.whatsapp_number, '\D', '', 'g'), 2)
FROM (SELECT value->>'calling_code' AS cc FROM "sales-pipe".settings WHERE key = 'phone_defaults') s
WHERE s.cc ~ '^\d{1,3}$' AND b.whatsapp_number ~ '^\s*0[1-9]';

UPDATE "sales-pipe".businesses b
SET phone = '+' || s.cc || substr(regexp_replace(b.phone, '\D', '', 'g'), 2)
FROM (SELECT value->>'calling_code' AS cc FROM "sales-pipe".settings WHERE key = 'phone_defaults') s
WHERE s.cc ~ '^\d{1,3}$' AND b.phone ~ '^\s*0[1-9]';

-- Recompute stored match values with the new rule
UPDATE "sales-pipe".businesses SET phone_normalised = "sales-pipe".normalise_phone(phone)
WHERE phone_normalised IS DISTINCT FROM "sales-pipe".normalise_phone(phone);
REINDEX INDEX "sales-pipe".idx_campaign_recipients_phone_norm;

-- Client Audience: country = two-letter code from the number (no fixed list)
ALTER TABLE "sales-pipe".customer_leads DROP CONSTRAINT IF EXISTS customer_leads_country_check;
ALTER TABLE "sales-pipe".customer_leads ALTER COLUMN country DROP DEFAULT;
ALTER TABLE "sales-pipe".customer_leads ALTER COLUMN country DROP NOT NULL;
UPDATE "sales-pipe".customer_leads SET country = CASE country WHEN 'UK' THEN 'GB' WHEN 'India' THEN 'IN' ELSE country END
WHERE country IN ('UK', 'India');
UPDATE "sales-pipe".customer_leads SET country = NULL WHERE country IS NOT NULL AND country !~ '^[A-Z]{2}$';
ALTER TABLE "sales-pipe".customer_leads ADD CONSTRAINT customer_leads_country_check CHECK (country IS NULL OR country ~ '^[A-Z]{2}$');

-- Client counts: the old "test" count (one fixed country) is no longer used
CREATE OR REPLACE VIEW "sales-pipe".customer_lead_counts WITH (security_invoker = true) AS
SELECT business_id,
    (count(*))::integer AS total,
    (count(*) FILTER (WHERE (is_ready AND (NOT do_not_contact))))::integer AS ready,
    (count(*) FILTER (WHERE ((NOT is_ready) AND (NOT do_not_contact))))::integer AS missing,
    (count(*) FILTER (WHERE do_not_contact))::integer AS do_not_contact,
    (count(*) FILTER (WHERE ((whatsapp_status = ANY (ARRAY['likely'::text, 'confirmed'::text])) AND (NOT do_not_contact))))::integer AS whatsapp,
    0 AS test,
    max(created_at) AS last_added_at
FROM "sales-pipe".customer_leads
GROUP BY business_id;

COMMIT;

NOTIFY pgrst, 'reload schema';
