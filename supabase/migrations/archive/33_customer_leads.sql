-- ==============================================================================
-- 33_customer_leads.sql
-- Table: "sales-pipe".customer_leads
-- Customer audience contacts associated with client businesses
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".customer_leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES "sales-pipe".businesses(id) ON DELETE CASCADE,
    country text NOT NULL DEFAULT 'UK' CHECK (country IN ('UK', 'India')),

    first_name text,
    last_name text,
    email text CHECK (email IS NULL OR email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),

    phone text,
    phone_e164 text,
    phone_type text CHECK (phone_type IS NULL OR phone_type IN ('mobile', 'landline', 'mobile_or_landline', 'other', 'invalid')),
    phone2 text,
    phone2_e164 text,
    phone2_type text CHECK (phone2_type IS NULL OR phone2_type IN ('mobile', 'landline', 'mobile_or_landline', 'other', 'invalid')),
    whatsapp_status text NOT NULL DEFAULT 'unknown' CHECK (whatsapp_status IN ('unknown', 'likely', 'confirmed', 'not_on_whatsapp', 'no_mobile')),

    town text,
    postcode text,
    last_purchase_on date,
    purchased text,
    birthday_month smallint CHECK (birthday_month IS NULL OR birthday_month BETWEEN 1 AND 12),
    tags text[] NOT NULL DEFAULT '{}',
    notes text,

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

-- Enable RLS
ALTER TABLE "sales-pipe".customer_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_leads_access ON "sales-pipe".customer_leads;
CREATE POLICY customer_leads_access ON "sales-pipe".customer_leads
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales'))
    WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales'));

REVOKE ALL ON "sales-pipe".customer_leads FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON "sales-pipe".customer_leads TO authenticated, service_role;

