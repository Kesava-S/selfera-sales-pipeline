-- ==============================================================================
-- 53_customer_leads.sql
-- Customer Leads (beta): the customers of our client businesses, which we market
-- to on the client's behalf. A business from Lead Management is the "database";
-- its customers are the rows.
--
-- Self-contained: adds new tables and a view only. Nothing existing is changed;
-- businesses is only referenced (read) for the link.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Imports: one row per CSV upload, so an import can be traced or removed
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "sales-pipe".customer_import_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES "sales-pipe".businesses(id) ON DELETE CASCADE,
    file_name text,
    created_count int NOT NULL DEFAULT 0,
    updated_count int NOT NULL DEFAULT 0,
    skipped_count int NOT NULL DEFAULT 0,
    created_by uuid DEFAULT auth.uid() REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 2. Customer leads
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "sales-pipe".customer_leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES "sales-pipe".businesses(id) ON DELETE CASCADE,
    country text NOT NULL DEFAULT 'UK' CHECK (country IN ('UK', 'India')),

    first_name text,
    last_name text,
    email text CHECK (email IS NULL OR email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),

    -- Phones as typed, the cleaned international form, and what kind of line it is
    phone text,
    phone_e164 text,
    phone_type text CHECK (phone_type IS NULL OR phone_type IN ('mobile', 'landline', 'mobile_or_landline', 'other', 'invalid')),
    phone2 text,
    phone2_e164 text,
    phone2_type text CHECK (phone2_type IS NULL OR phone2_type IN ('mobile', 'landline', 'mobile_or_landline', 'other', 'invalid')),
    -- WhatsApp can't be looked up; a mobile is "likely" until a message is delivered
    whatsapp_status text NOT NULL DEFAULT 'unknown' CHECK (whatsapp_status IN ('unknown', 'likely', 'confirmed', 'not_on_whatsapp', 'no_mobile')),

    town text,
    postcode text,
    last_purchase_on date,
    purchased text,
    birthday_month smallint CHECK (birthday_month IS NULL OR birthday_month BETWEEN 1 AND 12),
    tags text[] NOT NULL DEFAULT '{}',
    notes text,

    -- The client told us these customers agreed to marketing (UK GDPR / PECR)
    consent_confirmed boolean NOT NULL DEFAULT false,
    consent_confirmed_by uuid REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL,
    consent_confirmed_at timestamptz,

    do_not_contact boolean NOT NULL DEFAULT false,
    do_not_contact_reason text,
    do_not_contact_at timestamptz,

    source text NOT NULL DEFAULT 'form' CHECK (source IN ('form', 'csv')),
    import_batch_id uuid REFERENCES "sales-pipe".customer_import_batches(id) ON DELETE SET NULL,
    created_by uuid DEFAULT auth.uid() REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Ready to market to: a name, a way to reach them, and consent
    is_ready boolean NOT NULL GENERATED ALWAYS AS (
        coalesce(btrim(first_name), '') <> ''
        AND consent_confirmed
        AND (email IS NOT NULL
             OR coalesce(phone_type, '') IN ('mobile', 'landline', 'mobile_or_landline')
             OR coalesce(phone2_type, '') IN ('mobile', 'landline', 'mobile_or_landline'))
    ) STORED,

    CONSTRAINT customer_leads_has_identity CHECK (
        coalesce(btrim(first_name), '') <> '' OR email IS NOT NULL OR phone IS NOT NULL OR phone2 IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_customer_leads_business ON "sales-pipe".customer_leads (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_leads_batch ON "sales-pipe".customer_leads (import_batch_id);
-- One customer per email / phone within a business
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_leads_email ON "sales-pipe".customer_leads (business_id, lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_leads_phone ON "sales-pipe".customer_leads (business_id, phone_e164) WHERE phone_e164 IS NOT NULL;

CREATE OR REPLACE FUNCTION "sales-pipe".customer_leads_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = "sales-pipe", public
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_leads_touch ON "sales-pipe".customer_leads;
CREATE TRIGGER customer_leads_touch BEFORE UPDATE ON "sales-pipe".customer_leads
    FOR EACH ROW EXECUTE FUNCTION "sales-pipe".customer_leads_touch();

-- ------------------------------------------------------------------------------
-- 3. Counts per client business (respects the caller's access)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW "sales-pipe".customer_lead_counts
WITH (security_invoker = true) AS
SELECT business_id,
       count(*)::int AS total,
       count(*) FILTER (WHERE is_ready AND NOT do_not_contact)::int AS ready,
       count(*) FILTER (WHERE NOT is_ready AND NOT do_not_contact)::int AS missing,
       count(*) FILTER (WHERE do_not_contact)::int AS do_not_contact,
       count(*) FILTER (WHERE whatsapp_status IN ('likely', 'confirmed') AND NOT do_not_contact)::int AS whatsapp,
       count(*) FILTER (WHERE country = 'India')::int AS test,
       max(created_at) AS last_added_at
FROM "sales-pipe".customer_leads
GROUP BY business_id;

-- ------------------------------------------------------------------------------
-- 4. Access: our admin and sales team only
-- ------------------------------------------------------------------------------
ALTER TABLE "sales-pipe".customer_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe".customer_import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_leads_access ON "sales-pipe".customer_leads;
CREATE POLICY customer_leads_access ON "sales-pipe".customer_leads
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales'))
    WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales'));

DROP POLICY IF EXISTS customer_import_batches_access ON "sales-pipe".customer_import_batches;
CREATE POLICY customer_import_batches_access ON "sales-pipe".customer_import_batches
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales'))
    WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales'));

REVOKE ALL ON "sales-pipe".customer_leads, "sales-pipe".customer_import_batches, "sales-pipe".customer_lead_counts FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON "sales-pipe".customer_leads, "sales-pipe".customer_import_batches TO authenticated, service_role;
GRANT SELECT ON "sales-pipe".customer_lead_counts TO authenticated, service_role;

COMMIT;
