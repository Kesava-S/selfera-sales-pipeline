-- ==============================================================================
-- 13_v2_schema_setup.sql
-- Selfera Sales Dashboard v2 Schema Upgrade
-- ==============================================================================

SET search_path TO "sales-pipe", public;

-- ==============================================================================
-- RENAME LEGACY TABLES
-- ==============================================================================
-- We rename them now so we can safely create new tables (especially templates)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'leads' AND n.nspname = 'sales-pipe') THEN
        ALTER TABLE "sales-pipe".leads RENAME TO leads_legacy;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'tasks' AND n.nspname = 'sales-pipe') THEN
        ALTER TABLE "sales-pipe".tasks RENAME TO tasks_legacy;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'activity_log' AND n.nspname = 'sales-pipe') THEN
        ALTER TABLE "sales-pipe".activity_log RENAME TO activity_log_legacy;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'templates' AND n.nspname = 'sales-pipe') THEN
        ALTER TABLE "sales-pipe".templates RENAME TO templates_legacy;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'lead_service_history' AND n.nspname = 'sales-pipe') THEN
        ALTER TABLE "sales-pipe".lead_service_history RENAME TO lead_service_history_legacy;
    END IF;
END $$;


-- ==============================================================================
-- 1. ENUMS AND CHECK CONSTRAINTS PREPARATION
-- ==============================================================================
-- We will use Check Constraints (TEXT) as requested ("Use Postgres enums or check constraints for all fixed value lists below") to avoid dropping/recreating enums on changes.

-- ==============================================================================
-- 2. PROFILES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "sales-pipe".profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    role text NOT NULL CHECK (role IN ('admin', 'sales', 'consultant')),
    capacity int DEFAULT 150,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- ==============================================================================
-- 3. BUSINESSES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "sales-pipe".businesses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    business_code text UNIQUE, -- Handled by trigger
    business_name text NOT NULL,
    category text,
    business_type text NOT NULL,
    tier text CHECK (tier IN ('1-2 star', '3 star', '4-5 star')),
    room_count int,
    area text,
    address text,
    postcode text,
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
    existing_website text,
    company_type text DEFAULT 'Unknown' CHECK (company_type IN ('Limited company', 'Sole trader', 'Partnership', 'Unknown')),
    contact_name text,
    notes text,
    archived boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bus_phone_norm ON "sales-pipe".businesses(phone_normalised) WHERE phone_normalised IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bus_email_norm ON "sales-pipe".businesses(email_normalised) WHERE email_normalised IS NOT NULL;

-- Business Code Trigger
CREATE OR REPLACE FUNCTION "sales-pipe".generate_business_code()
RETURNS trigger AS $$
DECLARE
    next_id int;
BEGIN
    IF NEW.business_code IS NULL THEN
        -- Basic sequential counter. In a real system, you might use a sequence.
        SELECT COUNT(*) + 1 INTO next_id FROM "sales-pipe".businesses;
        NEW.business_code := 'BZ-' || LPAD(next_id::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_generate_business_code ON "sales-pipe".businesses;
CREATE TRIGGER trg_generate_business_code
    BEFORE INSERT ON "sales-pipe".businesses
    FOR EACH ROW EXECUTE FUNCTION "sales-pipe".generate_business_code();

-- ==============================================================================
-- 4. OPPORTUNITIES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "sales-pipe".opportunities (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    opportunity_code text UNIQUE,
    business_id uuid NOT NULL REFERENCES "sales-pipe".businesses(id) ON DELETE CASCADE,
    services_pitched text[] NOT NULL CHECK (array_length(services_pitched, 1) > 0),
    services_won text[],
    conversion_type text CHECK (conversion_type IN ('As pitched', 'Expanded', 'Switched', 'Narrowed')),
    converted_through text CHECK (converted_through IN ('Direct from outreach', 'Consultation', 'Demo', 'Follow-up conversation')),
    stage text DEFAULT 'Needs review' CHECK (stage IN ('Needs review', 'Active', 'Interested', 'Consultation', 'Won', 'Went cold', 'No response', 'Declined', 'Do not contact')),
    demo_link text,
    assigned_sales_id uuid REFERENCES "sales-pipe".profiles(id),
    assigned_consultant_id uuid REFERENCES "sales-pipe".profiles(id),
    consultation_at timestamptz,
    source_opportunity_id uuid REFERENCES "sales-pipe".opportunities(id),
    won_at timestamptz,
    closed_at timestamptz,
    upsell_reminder_on date,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opps_stage ON "sales-pipe".opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_opps_bus ON "sales-pipe".opportunities(business_id);
CREATE INDEX IF NOT EXISTS idx_opps_sales ON "sales-pipe".opportunities(assigned_sales_id);
CREATE INDEX IF NOT EXISTS idx_opps_consultant ON "sales-pipe".opportunities(assigned_consultant_id);
CREATE INDEX IF NOT EXISTS idx_opps_services ON "sales-pipe".opportunities USING GIN(services_pitched);

-- Opportunity Code Trigger
CREATE OR REPLACE FUNCTION "sales-pipe".generate_opportunity_code()
RETURNS trigger AS $$
DECLARE
    next_id int;
BEGIN
    IF NEW.opportunity_code IS NULL THEN
        SELECT COUNT(*) + 1 INTO next_id FROM "sales-pipe".opportunities;
        NEW.opportunity_code := 'OP-' || LPAD(next_id::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_generate_opp_code ON "sales-pipe".opportunities;
CREATE TRIGGER trg_generate_opp_code
    BEFORE INSERT ON "sales-pipe".opportunities
    FOR EACH ROW EXECUTE FUNCTION "sales-pipe".generate_opportunity_code();

-- ==============================================================================
-- 5. THREADS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "sales-pipe".threads (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    opportunity_id uuid NOT NULL REFERENCES "sales-pipe".opportunities(id) ON DELETE CASCADE,
    platform text NOT NULL CHECK (platform IN ('WhatsApp', 'Instagram', 'Facebook', 'Email', 'Phone', 'Walk-in')),
    status text DEFAULT 'Not contacted' CHECK (status IN ('Not contacted', 'Awaiting reply', 'Replied', 'Paused', 'No reply', 'Opted out')),
    step int DEFAULT 0 CHECK (step BETWEEN 0 AND 4),
    next_due_on date,
    last_outbound_at timestamptz,
    last_inbound_at timestamptz,
    paused_reason text,
    external_thread_id text,
    created_at timestamptz DEFAULT now(),
    UNIQUE(opportunity_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_threads_next_due ON "sales-pipe".threads(next_due_on);
CREATE INDEX IF NOT EXISTS idx_threads_status ON "sales-pipe".threads(status);
CREATE INDEX IF NOT EXISTS idx_threads_platform ON "sales-pipe".threads(platform);

-- ==============================================================================
-- 6. MESSAGES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "sales-pipe".messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id uuid NOT NULL REFERENCES "sales-pipe".threads(id) ON DELETE CASCADE,
    direction text NOT NULL CHECK (direction IN ('outbound', 'inbound', 'system')),
    body text NOT NULL,
    subject text,
    template_id uuid, -- will reference templates later
    step_label text,
    send_method text CHECK (send_method IN ('api', 'manual', 'webhook')),
    external_message_id text UNIQUE,
    media_url text,
    sent_by uuid REFERENCES "sales-pipe".profiles(id),
    delivery_status text CHECK (delivery_status IN ('queued', 'sent', 'failed')),
    error_detail text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_thread_time ON "sales-pipe".messages(thread_id, created_at DESC);

-- ==============================================================================
-- 7. TEMPLATES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "sales-pipe".templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    platform text NOT NULL CHECK (platform IN ('WhatsApp', 'Instagram', 'Facebook', 'Email', 'Phone', 'Walk-in')),
    step text NOT NULL CHECK (step IN ('First contact', 'Follow-up 1', 'Follow-up 2', 'Final check', 'Reply', 'Upsell')),
    services text[] NOT NULL,
    business_types text[] DEFAULT '{}',
    subject text,
    body text NOT NULL,
    whatsapp_template_name text,
    is_active boolean DEFAULT true,
    updated_at timestamptz DEFAULT now()
);

-- ==============================================================================
-- 8. DRAFTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "sales-pipe".drafts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id uuid NOT NULL REFERENCES "sales-pipe".threads(id) ON DELETE CASCADE,
    step_label text NOT NULL,
    template_id uuid REFERENCES "sales-pipe".templates(id),
    body text NOT NULL,
    subject text,
    missing_fields text[],
    status text DEFAULT 'ready' CHECK (status IN ('ready', 'needs_data', 'sent', 'discarded')),
    due_on date NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- ==============================================================================
-- 9. CONSULTATION BOOKINGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "sales-pipe".consultation_bookings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    business_name text NOT NULL,
    email text,
    phone text,
    booked_for timestamptz NOT NULL,
    message text,
    email_normalised text,
    phone_normalised text,
    matched_opportunity_id uuid REFERENCES "sales-pipe".opportunities(id) ON DELETE SET NULL,
    match_status text DEFAULT 'unmatched' CHECK (match_status IN ('matched', 'unmatched', 'linked_manually')),
    created_at timestamptz DEFAULT now()
);

-- ==============================================================================
-- 10. STAGE CHANGES (AUDIT)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "sales-pipe".stage_changes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    opportunity_id uuid NOT NULL REFERENCES "sales-pipe".opportunities(id) ON DELETE CASCADE,
    from_stage text,
    to_stage text,
    from_services text[],
    to_services text[],
    reason text,
    changed_by uuid REFERENCES "sales-pipe".profiles(id),
    created_at timestamptz DEFAULT now()
);

-- ==============================================================================
-- 11. NOTIFICATIONS (RE-USE OR ADJUST EXISTING IF NEEDED)
-- ==============================================================================
-- The previous schema already had `notifications`, but it had different constraints.
-- Let's just create a new one or modify it. Assuming we can alter or recreate.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'notifications' AND n.nspname = 'sales-pipe') THEN
        ALTER TABLE "sales-pipe".notifications RENAME TO notifications_legacy;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "sales-pipe".notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES "sales-pipe".profiles(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('new_reply', 'booking_matched', 'booking_unmatched', 'needs_consultant', 'assigned_to_you', 'upsell_due')),
    title text NOT NULL,
    link text,
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- ==============================================================================
-- 12. AUTOMATIC UPDATED_AT TRIGGERS
-- ==============================================================================
CREATE OR REPLACE FUNCTION "sales-pipe".update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_bus_updated_at ON "sales-pipe".businesses;
CREATE TRIGGER trg_bus_updated_at BEFORE UPDATE ON "sales-pipe".businesses
FOR EACH ROW EXECUTE FUNCTION "sales-pipe".update_updated_at_column();

DROP TRIGGER IF EXISTS trg_opps_updated_at ON "sales-pipe".opportunities;
CREATE TRIGGER trg_opps_updated_at BEFORE UPDATE ON "sales-pipe".opportunities
FOR EACH ROW EXECUTE FUNCTION "sales-pipe".update_updated_at_column();
