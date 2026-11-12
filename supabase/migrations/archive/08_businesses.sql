-- ==============================================================================
-- 08_businesses.sql
-- Table: "sales-pipe".businesses
-- Core business entity with consolidated contacts, validation queues, & branches
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".businesses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    business_code text UNIQUE,
    business_name text NOT NULL,
    category text,
    business_type text NOT NULL,
    tier text CHECK (tier IN ('1-2 star', '3 star', '4-5 star')),
    room_count int,
    area text,
    address text,
    postcode text,
    branches jsonb DEFAULT '[]'::jsonb,
    maps_link text,
    google_rating numeric,
    google_reviews_count int,
    phone text,
    phone_normalised text,
    whatsapp_number text,
    email text,
    email_normalised text,
    instagram text,
    facebook text,
    linkedin text,
    existing_website text,
    has_no_website boolean DEFAULT false,
    company_type text DEFAULT 'Unknown' CHECK (company_type IN ('Limited company', 'Sole trader', 'Partnership', 'Unknown')),
    contact_name text,
    owner_name text,
    owner_contact text,
    owner_email text,
    tech_partner_type text CHECK (tech_partner_type IN ('Agency', 'DIY', 'None') OR tech_partner_type IS NULL),
    tech_partner_name text,
    gaps_found text,
    source text,
    problems text[] DEFAULT '{}'::text[],
    import_batch_id uuid REFERENCES "sales-pipe".import_batches(id) ON DELETE SET NULL,
    notes text,
    archived boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_businesses_name ON "sales-pipe".businesses(business_name);
CREATE INDEX IF NOT EXISTS idx_businesses_type ON "sales-pipe".businesses(business_type);
CREATE INDEX IF NOT EXISTS idx_businesses_category ON "sales-pipe".businesses(category);
CREATE INDEX IF NOT EXISTS idx_businesses_postcode ON "sales-pipe".businesses(postcode);
CREATE INDEX IF NOT EXISTS idx_businesses_batch_id ON "sales-pipe".businesses(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_businesses_problems ON "sales-pipe".businesses USING gin(problems);
CREATE INDEX IF NOT EXISTS idx_businesses_archived ON "sales-pipe".businesses(archived);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bus_phone_norm ON "sales-pipe".businesses(phone_normalised) WHERE phone_normalised IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bus_email_norm ON "sales-pipe".businesses(email_normalised) WHERE email_normalised IS NOT NULL;

-- Business Code Trigger
CREATE OR REPLACE FUNCTION "sales-pipe".generate_business_code()
RETURNS trigger AS $$
DECLARE
    next_id int;
BEGIN
    IF NEW.business_code IS NULL THEN
        SELECT COUNT(*) + 1 INTO next_id FROM "sales-pipe".businesses;
        NEW.business_code := 'BZ-' || LPAD(next_id::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'sales-pipe', 'public';

DROP TRIGGER IF EXISTS trg_generate_business_code ON "sales-pipe".businesses;
CREATE TRIGGER trg_generate_business_code
    BEFORE INSERT ON "sales-pipe".businesses
    FOR EACH ROW EXECUTE FUNCTION "sales-pipe".generate_business_code();

-- Enable RLS
ALTER TABLE "sales-pipe".businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "businesses_select_all" ON "sales-pipe".businesses;
CREATE POLICY "businesses_select_all" ON "sales-pipe".businesses
    FOR SELECT TO authenticated
    USING ("sales-pipe".get_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "businesses_admin_manage" ON "sales-pipe".businesses;
CREATE POLICY "businesses_admin_manage" ON "sales-pipe".businesses
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() = 'admin')
    WITH CHECK ("sales-pipe".get_user_role() = 'admin');

DROP POLICY IF EXISTS "businesses_sales_manage" ON "sales-pipe".businesses;
CREATE POLICY "businesses_sales_manage" ON "sales-pipe".businesses
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('sales', 'consultant'))
    WITH CHECK ("sales-pipe".get_user_role() IN ('sales', 'consultant'));
