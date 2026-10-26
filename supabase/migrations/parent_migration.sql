-- ==============================================================================
-- parent_migration.sql
-- COMPLETE CONSOLIDATED MASTER SCHEMA FOR SCHEMA: "sales-pipe"
-- Self-contained deployment containing:
-- 1. Schema Init, Permissions, and Auth Helpers
-- 2. All Core & Dynamic Tables + Indexes + Row Level Security (RLS)
-- 3. Business Logic, Validation Triggers, and Stored Procedures (RPCs)
-- 4. Default Seed Configurations
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS "sales-pipe";

-- Permissions
GRANT USAGE ON SCHEMA "sales-pipe" TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA "sales-pipe" TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA "sales-pipe" TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA "sales-pipe" TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA "sales-pipe" GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA "sales-pipe" GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA "sales-pipe" GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- Role Helper Functions
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".get_user_role()
RETURNS text AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role
    FROM "sales-pipe".profiles
    WHERE id = auth.uid() AND is_active = true;
    RETURN v_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'sales-pipe', 'public';

CREATE OR REPLACE FUNCTION "sales-pipe".require_role(required_roles text[])
RETURNS void AS $$
DECLARE
    v_role text;
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN;
    END IF;
    v_role := "sales-pipe".get_user_role();
    IF v_role IS NULL OR NOT (v_role = ANY(required_roles)) THEN
        RAISE EXCEPTION 'Forbidden: insufficient role "%"', coalesce(v_role, 'none');
    END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'sales-pipe', 'public';

-- ==============================================================================
-- TABLES & ENTITIES
-- ==============================================================================

-- 1. profiles
CREATE TABLE IF NOT EXISTS "sales-pipe".profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    full_name text NOT NULL,
    role text NOT NULL CHECK (role IN ('admin', 'sales', 'consultant')),
    display_role text,
    capacity int DEFAULT 50,
    is_active boolean DEFAULT true,
    avatar_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON "sales-pipe".profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON "sales-pipe".profiles(is_active);
ALTER TABLE "sales-pipe".profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_policy" ON "sales-pipe".profiles;
CREATE POLICY "profiles_select_policy" ON "sales-pipe".profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profiles_admin_all" ON "sales-pipe".profiles;
CREATE POLICY "profiles_admin_all" ON "sales-pipe".profiles FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() = 'admin' OR id = auth.uid())
    WITH CHECK ("sales-pipe".get_user_role() = 'admin' OR id = auth.uid());

-- 2. business_categories
CREATE TABLE IF NOT EXISTS "sales-pipe".business_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    slug text NOT NULL UNIQUE,
    icon_name text DEFAULT 'Building2',
    description text,
    category_group text,
    synonyms text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_business_categories_active ON "sales-pipe".business_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_business_categories_slug ON "sales-pipe".business_categories(slug);
ALTER TABLE "sales-pipe".business_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "business_categories_read" ON "sales-pipe".business_categories;
CREATE POLICY "business_categories_read" ON "sales-pipe".business_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "business_categories_admin_manage" ON "sales-pipe".business_categories;
CREATE POLICY "business_categories_admin_manage" ON "sales-pipe".business_categories FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() = 'admin') WITH CHECK ("sales-pipe".get_user_role() = 'admin');

-- 3. services
CREATE TABLE IF NOT EXISTS "sales-pipe".services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    code text NOT NULL UNIQUE,
    description text,
    price_range text,
    is_active boolean DEFAULT true,
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_services_code ON "sales-pipe".services(code);
CREATE INDEX IF NOT EXISTS idx_services_active ON "sales-pipe".services(is_active);
ALTER TABLE "sales-pipe".services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "services_read" ON "sales-pipe".services;
CREATE POLICY "services_read" ON "sales-pipe".services FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "services_admin_manage" ON "sales-pipe".services;
CREATE POLICY "services_admin_manage" ON "sales-pipe".services FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() = 'admin') WITH CHECK ("sales-pipe".get_user_role() = 'admin');

-- 4. outreach_platforms
CREATE TABLE IF NOT EXISTS "sales-pipe".outreach_platforms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    slug text NOT NULL UNIQUE,
    is_direct_send boolean DEFAULT false,
    daily_limit int DEFAULT 100,
    is_active boolean DEFAULT true,
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outreach_platforms_slug ON "sales-pipe".outreach_platforms(slug);
CREATE INDEX IF NOT EXISTS idx_outreach_platforms_active ON "sales-pipe".outreach_platforms(is_active);
ALTER TABLE "sales-pipe".outreach_platforms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "outreach_platforms_read" ON "sales-pipe".outreach_platforms;
CREATE POLICY "outreach_platforms_read" ON "sales-pipe".outreach_platforms FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "outreach_platforms_admin_manage" ON "sales-pipe".outreach_platforms;
CREATE POLICY "outreach_platforms_admin_manage" ON "sales-pipe".outreach_platforms FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() = 'admin') WITH CHECK ("sales-pipe".get_user_role() = 'admin');

-- 5. pipeline_settings
CREATE TABLE IF NOT EXISTS "sales-pipe".pipeline_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL UNIQUE,
    value jsonb NOT NULL,
    description text,
    updated_by uuid REFERENCES "sales-pipe".profiles(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_settings_key ON "sales-pipe".pipeline_settings(key);
ALTER TABLE "sales-pipe".pipeline_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pipeline_settings_read" ON "sales-pipe".pipeline_settings;
CREATE POLICY "pipeline_settings_read" ON "sales-pipe".pipeline_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pipeline_settings_admin_manage" ON "sales-pipe".pipeline_settings;
CREATE POLICY "pipeline_settings_admin_manage" ON "sales-pipe".pipeline_settings FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() = 'admin') WITH CHECK ("sales-pipe".get_user_role() = 'admin');

-- 6. import_batches
CREATE TABLE IF NOT EXISTS "sales-pipe".import_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name text NOT NULL,
    uploaded_by uuid REFERENCES "sales-pipe".profiles(id),
    total_rows int DEFAULT 0,
    ready_count int DEFAULT 0,
    missing_count int DEFAULT 0,
    failed_count int DEFAULT 0,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_import_batches_uploaded_by ON "sales-pipe".import_batches(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_import_batches_created_at ON "sales-pipe".import_batches(created_at DESC);
ALTER TABLE "sales-pipe".import_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "import_batches_read" ON "sales-pipe".import_batches;
CREATE POLICY "import_batches_read" ON "sales-pipe".import_batches FOR SELECT TO authenticated USING ("sales-pipe".get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "import_batches_manage" ON "sales-pipe".import_batches;
CREATE POLICY "import_batches_manage" ON "sales-pipe".import_batches FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales')) WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales'));

-- 7. businesses
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
CREATE INDEX IF NOT EXISTS idx_businesses_name ON "sales-pipe".businesses(business_name);
CREATE INDEX IF NOT EXISTS idx_businesses_type ON "sales-pipe".businesses(business_type);
CREATE INDEX IF NOT EXISTS idx_businesses_category ON "sales-pipe".businesses(category);
CREATE INDEX IF NOT EXISTS idx_businesses_postcode ON "sales-pipe".businesses(postcode);
CREATE INDEX IF NOT EXISTS idx_businesses_batch_id ON "sales-pipe".businesses(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_businesses_problems ON "sales-pipe".businesses USING gin(problems);
CREATE INDEX IF NOT EXISTS idx_businesses_archived ON "sales-pipe".businesses(archived);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bus_phone_norm ON "sales-pipe".businesses(phone_normalised) WHERE phone_normalised IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bus_email_norm ON "sales-pipe".businesses(email_normalised) WHERE email_normalised IS NOT NULL;

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

ALTER TABLE "sales-pipe".businesses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "businesses_select_all" ON "sales-pipe".businesses;
CREATE POLICY "businesses_select_all" ON "sales-pipe".businesses FOR SELECT TO authenticated USING ("sales-pipe".get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "businesses_admin_manage" ON "sales-pipe".businesses;
CREATE POLICY "businesses_admin_manage" ON "sales-pipe".businesses FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() = 'admin') WITH CHECK ("sales-pipe".get_user_role() = 'admin');
DROP POLICY IF EXISTS "businesses_sales_manage" ON "sales-pipe".businesses;
CREATE POLICY "businesses_sales_manage" ON "sales-pipe".businesses FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('sales', 'consultant')) WITH CHECK ("sales-pipe".get_user_role() IN ('sales', 'consultant'));

-- 8. opportunities
CREATE TABLE IF NOT EXISTS "sales-pipe".opportunities (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    opportunity_code text UNIQUE,
    business_id uuid NOT NULL REFERENCES "sales-pipe".businesses(id) ON DELETE CASCADE,
    services_pitched text[] NOT NULL DEFAULT '{}'::text[],
    stage text NOT NULL DEFAULT 'Identified' CHECK (stage IN (
        'Identified',
        'Outreach queued',
        'Outreach sent',
        'Follow-up 1',
        'Follow-up 2',
        'Replied - positive',
        'Replied - negative',
        'Audit delivered',
        'Call booked',
        'Call completed',
        'Closed - won',
        'Closed - lost'
    )),
    assigned_sales_id uuid REFERENCES "sales-pipe".profiles(id),
    assigned_consultant_id uuid REFERENCES "sales-pipe".profiles(id),
    deal_value numeric,
    expected_close_date date,
    stage_entered_at timestamptz DEFAULT now(),
    archived boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_opps_business ON "sales-pipe".opportunities(business_id);
CREATE INDEX IF NOT EXISTS idx_opps_stage ON "sales-pipe".opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_opps_assigned_sales ON "sales-pipe".opportunities(assigned_sales_id);
CREATE INDEX IF NOT EXISTS idx_opps_assigned_consultant ON "sales-pipe".opportunities(assigned_consultant_id);
CREATE INDEX IF NOT EXISTS idx_opps_archived ON "sales-pipe".opportunities(archived);
CREATE INDEX IF NOT EXISTS idx_opps_stage_entered ON "sales-pipe".opportunities(stage_entered_at);

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'sales-pipe', 'public';

DROP TRIGGER IF EXISTS trg_generate_opportunity_code ON "sales-pipe".opportunities;
CREATE TRIGGER trg_generate_opportunity_code
    BEFORE INSERT ON "sales-pipe".opportunities
    FOR EACH ROW EXECUTE FUNCTION "sales-pipe".generate_opportunity_code();

ALTER TABLE "sales-pipe".opportunities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "opportunities_select" ON "sales-pipe".opportunities;
CREATE POLICY "opportunities_select" ON "sales-pipe".opportunities FOR SELECT TO authenticated USING ("sales-pipe".get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "opportunities_admin_manage" ON "sales-pipe".opportunities;
CREATE POLICY "opportunities_admin_manage" ON "sales-pipe".opportunities FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() = 'admin') WITH CHECK ("sales-pipe".get_user_role() = 'admin');
DROP POLICY IF EXISTS "opportunities_sales_consultant_manage" ON "sales-pipe".opportunities;
CREATE POLICY "opportunities_sales_consultant_manage" ON "sales-pipe".opportunities FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('sales', 'consultant')) WITH CHECK ("sales-pipe".get_user_role() IN ('sales', 'consultant'));

-- 9. threads
CREATE TABLE IF NOT EXISTS "sales-pipe".threads (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    opportunity_id uuid NOT NULL REFERENCES "sales-pipe".opportunities(id) ON DELETE CASCADE,
    platform text NOT NULL CHECK (platform IN ('Email', 'WhatsApp', 'Instagram', 'LinkedIn', 'Phone', 'Walk-in')),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting_reply', 'replied', 'closed')),
    last_message_at timestamptz,
    unread_count int DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_threads_opportunity ON "sales-pipe".threads(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_threads_platform ON "sales-pipe".threads(platform);
CREATE INDEX IF NOT EXISTS idx_threads_status ON "sales-pipe".threads(status);
CREATE INDEX IF NOT EXISTS idx_threads_last_msg ON "sales-pipe".threads(last_message_at DESC);
ALTER TABLE "sales-pipe".threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "threads_select" ON "sales-pipe".threads;
CREATE POLICY "threads_select" ON "sales-pipe".threads FOR SELECT TO authenticated USING ("sales-pipe".get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "threads_manage" ON "sales-pipe".threads;
CREATE POLICY "threads_manage" ON "sales-pipe".threads FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales', 'consultant')) WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales', 'consultant'));

-- 10. messages
CREATE TABLE IF NOT EXISTS "sales-pipe".messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id uuid NOT NULL REFERENCES "sales-pipe".threads(id) ON DELETE CASCADE,
    direction text NOT NULL CHECK (direction IN ('inbound', 'outbound', 'system')),
    sender_id uuid REFERENCES "sales-pipe".profiles(id),
    subject text,
    body text NOT NULL,
    step_label text,
    send_method text,
    delivery_status text DEFAULT 'sent' CHECK (delivery_status IN ('queued', 'sent', 'delivered', 'read', 'failed', 'bounced', 'complained')),
    delivered_at timestamptz,
    read_at timestamptz,
    opened_at timestamptz,
    clicked_at timestamptz,
    error_detail text,
    attachments jsonb DEFAULT '[]'::jsonb,
    is_read boolean DEFAULT false,
    external_id text,
    external_message_id text,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON "sales-pipe".messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON "sales-pipe".messages(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON "sales-pipe".messages(is_read) WHERE NOT is_read;
CREATE INDEX IF NOT EXISTS idx_messages_external_id ON "sales-pipe".messages(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_external_msg_id ON "sales-pipe".messages(external_message_id) WHERE external_message_id IS NOT NULL;
ALTER TABLE "sales-pipe".messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_select" ON "sales-pipe".messages;
CREATE POLICY "messages_select" ON "sales-pipe".messages FOR SELECT TO authenticated USING ("sales-pipe".get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "messages_manage" ON "sales-pipe".messages;
CREATE POLICY "messages_manage" ON "sales-pipe".messages FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales', 'consultant')) WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales', 'consultant'));

-- 11. templates
CREATE TABLE IF NOT EXISTS "sales-pipe".templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    platform text NOT NULL,
    step text NOT NULL,
    business_types text[] DEFAULT '{}'::text[],
    services text[] DEFAULT '{}'::text[],
    subject text,
    body text NOT NULL,
    whatsapp_template_name text,
    is_active boolean DEFAULT true,
    created_by uuid REFERENCES "sales-pipe".profiles(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_templates_platform ON "sales-pipe".templates(platform);
CREATE INDEX IF NOT EXISTS idx_templates_step ON "sales-pipe".templates(step);
CREATE INDEX IF NOT EXISTS idx_templates_active ON "sales-pipe".templates(is_active);
ALTER TABLE "sales-pipe".templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "templates_select" ON "sales-pipe".templates;
CREATE POLICY "templates_select" ON "sales-pipe".templates FOR SELECT TO authenticated USING ("sales-pipe".get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "templates_manage" ON "sales-pipe".templates;
CREATE POLICY "templates_manage" ON "sales-pipe".templates FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales')) WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales'));

-- 12. drafts
CREATE TABLE IF NOT EXISTS "sales-pipe".drafts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id uuid NOT NULL REFERENCES "sales-pipe".threads(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES "sales-pipe".profiles(id) ON DELETE CASCADE,
    subject text,
    body text NOT NULL,
    attachments jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(thread_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_drafts_thread_user ON "sales-pipe".drafts(thread_id, user_id);
ALTER TABLE "sales-pipe".drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "drafts_select" ON "sales-pipe".drafts;
CREATE POLICY "drafts_select" ON "sales-pipe".drafts FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR "sales-pipe".get_user_role() = 'admin');
DROP POLICY IF EXISTS "drafts_manage" ON "sales-pipe".drafts;
CREATE POLICY "drafts_manage" ON "sales-pipe".drafts FOR ALL TO authenticated
    USING (user_id = auth.uid() OR "sales-pipe".get_user_role() = 'admin')
    WITH CHECK (user_id = auth.uid() OR "sales-pipe".get_user_role() = 'admin');

-- 13. consultation_bookings
CREATE TABLE IF NOT EXISTS "sales-pipe".consultation_bookings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    opportunity_id uuid NOT NULL REFERENCES "sales-pipe".opportunities(id) ON DELETE CASCADE,
    consultant_id uuid REFERENCES "sales-pipe".profiles(id),
    scheduled_at timestamptz NOT NULL,
    duration_minutes int DEFAULT 30,
    meeting_link text,
    status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bookings_opportunity ON "sales-pipe".consultation_bookings(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_bookings_consultant ON "sales-pipe".consultation_bookings(consultant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled ON "sales-pipe".consultation_bookings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON "sales-pipe".consultation_bookings(status);
ALTER TABLE "sales-pipe".consultation_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bookings_select" ON "sales-pipe".consultation_bookings;
CREATE POLICY "bookings_select" ON "sales-pipe".consultation_bookings FOR SELECT TO authenticated USING ("sales-pipe".get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "bookings_manage" ON "sales-pipe".consultation_bookings;
CREATE POLICY "bookings_manage" ON "sales-pipe".consultation_bookings FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales', 'consultant')) WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales', 'consultant'));

-- 14. stage_changes
CREATE TABLE IF NOT EXISTS "sales-pipe".stage_changes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    opportunity_id uuid NOT NULL REFERENCES "sales-pipe".opportunities(id) ON DELETE CASCADE,
    from_stage text,
    to_stage text NOT NULL,
    changed_by uuid REFERENCES "sales-pipe".profiles(id),
    reason text,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stage_changes_opp ON "sales-pipe".stage_changes(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_stage_changes_created ON "sales-pipe".stage_changes(created_at DESC);
ALTER TABLE "sales-pipe".stage_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stage_changes_select" ON "sales-pipe".stage_changes;
CREATE POLICY "stage_changes_select" ON "sales-pipe".stage_changes FOR SELECT TO authenticated USING ("sales-pipe".get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "stage_changes_insert" ON "sales-pipe".stage_changes;
CREATE POLICY "stage_changes_insert" ON "sales-pipe".stage_changes FOR INSERT TO authenticated
    WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales', 'consultant'));

-- 15. notifications
CREATE TABLE IF NOT EXISTS "sales-pipe".notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES "sales-pipe".profiles(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('new_reply', 'booking_matched', 'booking_unmatched', 'needs_consultant', 'assigned_to_you', 'upsell_due', 'unsubscribed')),
    title text NOT NULL,
    message text,
    link text,
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON "sales-pipe".notifications(user_id, is_read) WHERE NOT is_read;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON "sales-pipe".notifications(created_at DESC);
ALTER TABLE "sales-pipe".notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select_own" ON "sales-pipe".notifications;
CREATE POLICY "notifications_select_own" ON "sales-pipe".notifications FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR "sales-pipe".get_user_role() = 'admin');
DROP POLICY IF EXISTS "notifications_update_own" ON "sales-pipe".notifications;
CREATE POLICY "notifications_update_own" ON "sales-pipe".notifications FOR UPDATE TO authenticated
    USING (user_id = auth.uid() OR "sales-pipe".get_user_role() = 'admin') WITH CHECK (user_id = auth.uid() OR "sales-pipe".get_user_role() = 'admin');
DROP POLICY IF EXISTS "notifications_insert" ON "sales-pipe".notifications;
CREATE POLICY "notifications_insert" ON "sales-pipe".notifications FOR INSERT TO authenticated WITH CHECK (true);

-- 16. notes
CREATE TABLE IF NOT EXISTS "sales-pipe".notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id uuid REFERENCES "sales-pipe".opportunities(id) ON DELETE CASCADE,
    business_id uuid REFERENCES "sales-pipe".businesses(id) ON DELETE CASCADE,
    author_id uuid REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL,
    body text NOT NULL,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notes_opp ON "sales-pipe".notes(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_notes_biz ON "sales-pipe".notes(business_id);
CREATE INDEX IF NOT EXISTS idx_notes_created ON "sales-pipe".notes(created_at DESC);
ALTER TABLE "sales-pipe".notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notes_select" ON "sales-pipe".notes;
CREATE POLICY "notes_select" ON "sales-pipe".notes FOR SELECT TO authenticated USING ("sales-pipe".get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "notes_manage" ON "sales-pipe".notes;
CREATE POLICY "notes_manage" ON "sales-pipe".notes FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales', 'consultant')) WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales', 'consultant'));

-- 17. cadence_rules
CREATE TABLE IF NOT EXISTS "sales-pipe".cadence_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    step_name text NOT NULL UNIQUE,
    days_delay int NOT NULL DEFAULT 3,
    description text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cadence_rules_step ON "sales-pipe".cadence_rules(step_name);
ALTER TABLE "sales-pipe".cadence_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cadence_rules_read" ON "sales-pipe".cadence_rules;
CREATE POLICY "cadence_rules_read" ON "sales-pipe".cadence_rules FOR SELECT TO authenticated USING ("sales-pipe".get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "cadence_rules_admin_manage" ON "sales-pipe".cadence_rules;
CREATE POLICY "cadence_rules_admin_manage" ON "sales-pipe".cadence_rules FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() = 'admin') WITH CHECK ("sales-pipe".get_user_role() = 'admin');

-- 18. tasks
CREATE TABLE IF NOT EXISTS "sales-pipe".tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id uuid REFERENCES "sales-pipe".opportunities(id) ON DELETE CASCADE,
    business_id uuid REFERENCES "sales-pipe".businesses(id) ON DELETE CASCADE,
    assigned_to uuid REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL,
    title text NOT NULL,
    description text,
    due_at timestamptz,
    status text NOT NULL DEFAULT 'pending',
    priority text NOT NULL DEFAULT 'normal',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_opp ON "sales-pipe".tasks(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_tasks_biz ON "sales-pipe".tasks(business_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON "sales-pipe".tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON "sales-pipe".tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON "sales-pipe".tasks(due_at);
ALTER TABLE "sales-pipe".tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tasks_select" ON "sales-pipe".tasks;
CREATE POLICY "tasks_select" ON "sales-pipe".tasks FOR SELECT TO authenticated USING ("sales-pipe".get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "tasks_manage" ON "sales-pipe".tasks;
CREATE POLICY "tasks_manage" ON "sales-pipe".tasks FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales', 'consultant')) WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales', 'consultant'));

-- 19. opt_outs
CREATE TABLE IF NOT EXISTS "sales-pipe".opt_outs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier text NOT NULL,
    channel text NOT NULL DEFAULT 'All',
    reason text,
    source text DEFAULT 'inbound',
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_opt_outs_identifier ON "sales-pipe".opt_outs(identifier);
CREATE INDEX IF NOT EXISTS idx_opt_outs_identifier_lower ON "sales-pipe".opt_outs (lower(identifier));
CREATE INDEX IF NOT EXISTS idx_opt_outs_channel ON "sales-pipe".opt_outs(channel);
ALTER TABLE "sales-pipe".opt_outs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "opt_outs_select" ON "sales-pipe".opt_outs;
CREATE POLICY "opt_outs_select" ON "sales-pipe".opt_outs FOR SELECT TO authenticated USING ("sales-pipe".get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "opt_outs_manage" ON "sales-pipe".opt_outs;
CREATE POLICY "opt_outs_manage" ON "sales-pipe".opt_outs FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales')) WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales'));

-- 20. webhook_events
CREATE TABLE IF NOT EXISTS "sales-pipe".webhook_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source text NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    error_message text,
    created_at timestamptz DEFAULT now(),
    processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON "sales-pipe".webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_source ON "sales-pipe".webhook_events(source);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON "sales-pipe".webhook_events(created_at DESC);
ALTER TABLE "sales-pipe".webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "webhook_events_admin" ON "sales-pipe".webhook_events;
CREATE POLICY "webhook_events_admin" ON "sales-pipe".webhook_events FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() = 'admin') WITH CHECK ("sales-pipe".get_user_role() = 'admin');

-- 21. email_databases
CREATE TABLE IF NOT EXISTS "sales-pipe".email_databases (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    contacts jsonb DEFAULT '[]'::jsonb,
    contact_count integer DEFAULT 0,
    created_by uuid REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_databases_created_by ON "sales-pipe".email_databases(created_by);
CREATE INDEX IF NOT EXISTS idx_email_databases_created_at ON "sales-pipe".email_databases(created_at DESC);
ALTER TABLE "sales-pipe".email_databases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_databases_access" ON "sales-pipe".email_databases;
CREATE POLICY "email_databases_access" ON "sales-pipe".email_databases FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales')) WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales'));
GRANT ALL ON "sales-pipe".email_databases TO authenticated, anon, service_role;

-- 22. email_campaigns
CREATE TABLE IF NOT EXISTS "sales-pipe".email_campaigns (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    subject text NOT NULL,
    preheader text,
    body text NOT NULL,
    service text DEFAULT 'General',
    database_id uuid REFERENCES "sales-pipe".email_databases(id) ON DELETE SET NULL,
    database_name text,
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'archived')),
    recipient_count integer DEFAULT 0,
    recipients jsonb DEFAULT '[]'::jsonb,
    sent_at timestamptz,
    scheduled_at timestamptz,
    created_by uuid REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON "sales-pipe".email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_database ON "sales-pipe".email_campaigns(database_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_created ON "sales-pipe".email_campaigns(created_at DESC);
ALTER TABLE "sales-pipe".email_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_campaigns_access" ON "sales-pipe".email_campaigns;
CREATE POLICY "email_campaigns_access" ON "sales-pipe".email_campaigns FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IS NOT NULL) WITH CHECK ("sales-pipe".get_user_role() IS NOT NULL);
REVOKE ALL ON "sales-pipe".email_campaigns FROM anon;
GRANT ALL ON "sales-pipe".email_campaigns TO authenticated, service_role;

-- 23. campaign_recipients
CREATE TABLE IF NOT EXISTS "sales-pipe".campaign_recipients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'whatsapp')),
    campaign_id uuid REFERENCES "sales-pipe".email_campaigns(id) ON DELETE CASCADE,
    whatsapp_campaign_id uuid REFERENCES "sales-pipe".whatsapp_campaigns(id) ON DELETE CASCADE,
    business_id uuid REFERENCES "sales-pipe".businesses(id) ON DELETE SET NULL,
    email text,
    phone text,
    business_name text,
    contact_name text,
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'skipped')),
    delivery_status text CHECK (delivery_status IS NULL OR delivery_status IN ('sent', 'delivered', 'read', 'failed', 'bounced', 'complained')),
    attempts int NOT NULL DEFAULT 0,
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    locked_at timestamptz,
    sent_at timestamptz,
    delivered_at timestamptz,
    read_at timestamptz,
    opened_at timestamptz,
    clicked_at timestamptz,
    external_message_id text,
    error_detail text,
    simulated boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT campaign_recipients_target_check CHECK (
        (channel = 'email' AND campaign_id IS NOT NULL AND whatsapp_campaign_id IS NULL AND email IS NOT NULL)
        OR (channel = 'whatsapp' AND whatsapp_campaign_id IS NOT NULL AND campaign_id IS NULL AND phone IS NOT NULL)
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_recipients_email
    ON "sales-pipe".campaign_recipients (campaign_id, lower(email)) WHERE channel = 'email';
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_recipients_phone
    ON "sales-pipe".campaign_recipients (whatsapp_campaign_id, regexp_replace(phone, '\D', '', 'g')) WHERE channel = 'whatsapp';
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_due
    ON "sales-pipe".campaign_recipients (next_attempt_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_wa_cid
    ON "sales-pipe".campaign_recipients (whatsapp_campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_cid
    ON "sales-pipe".campaign_recipients (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_bid
    ON "sales-pipe".campaign_recipients (business_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status
    ON "sales-pipe".campaign_recipients (status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_external
    ON "sales-pipe".campaign_recipients (external_message_id) WHERE external_message_id IS NOT NULL;
ALTER TABLE "sales-pipe".campaign_recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "campaign_recipients_select" ON "sales-pipe".campaign_recipients;
CREATE POLICY "campaign_recipients_select" ON "sales-pipe".campaign_recipients FOR SELECT TO authenticated USING ("sales-pipe".get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "campaign_recipients_manage" ON "sales-pipe".campaign_recipients;
CREATE POLICY "campaign_recipients_manage" ON "sales-pipe".campaign_recipients FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IS NOT NULL) WITH CHECK ("sales-pipe".get_user_role() IS NOT NULL);
REVOKE ALL ON "sales-pipe".campaign_recipients FROM anon;
GRANT ALL ON "sales-pipe".campaign_recipients TO authenticated, service_role;

-- 24. whatsapp_databases
CREATE TABLE IF NOT EXISTS "sales-pipe".whatsapp_databases (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    contacts jsonb DEFAULT '[]'::jsonb,
    contact_count integer DEFAULT 0,
    created_by uuid REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_databases_created_by ON "sales-pipe".whatsapp_databases(created_by);
CREATE INDEX IF NOT EXISTS idx_whatsapp_databases_created_at ON "sales-pipe".whatsapp_databases(created_at DESC);
ALTER TABLE "sales-pipe".whatsapp_databases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "whatsapp_databases_access" ON "sales-pipe".whatsapp_databases;
CREATE POLICY "whatsapp_databases_access" ON "sales-pipe".whatsapp_databases FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IS NOT NULL) WITH CHECK ("sales-pipe".get_user_role() IS NOT NULL);
REVOKE ALL ON "sales-pipe".whatsapp_databases FROM anon;
GRANT ALL ON "sales-pipe".whatsapp_databases TO authenticated, service_role;

-- 25. whatsapp_campaigns
CREATE TABLE IF NOT EXISTS "sales-pipe".whatsapp_campaigns (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    message text NOT NULL,
    template_name text,
    service text DEFAULT 'General',
    database_id uuid REFERENCES "sales-pipe".whatsapp_databases(id) ON DELETE SET NULL,
    database_name text,
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'archived')),
    recipient_count integer DEFAULT 0,
    recipients jsonb DEFAULT '[]'::jsonb,
    sent_at timestamptz,
    scheduled_at timestamptz,
    created_by uuid REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_status ON "sales-pipe".whatsapp_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_database ON "sales-pipe".whatsapp_campaigns(database_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_created ON "sales-pipe".whatsapp_campaigns(created_at DESC);
ALTER TABLE "sales-pipe".whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "whatsapp_campaigns_access" ON "sales-pipe".whatsapp_campaigns;
CREATE POLICY "whatsapp_campaigns_access" ON "sales-pipe".whatsapp_campaigns FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IS NOT NULL) WITH CHECK ("sales-pipe".get_user_role() IS NOT NULL);
REVOKE ALL ON "sales-pipe".whatsapp_campaigns FROM anon;
GRANT ALL ON "sales-pipe".whatsapp_campaigns TO authenticated, service_role;

-- ==============================================================================
-- FUNCTIONS, TRIGGERS, & STORED PROCEDURES
-- ==============================================================================

CREATE OR REPLACE FUNCTION "sales-pipe".valid_services()
RETURNS text[]
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce(array_agg(s.name ORDER BY s.sort_order, s.name), '{}')
  FROM "sales-pipe".services s
$$;

CREATE OR REPLACE FUNCTION "sales-pipe".clean_handle(p text)
RETURNS text AS $$
    SELECT nullif(trim(both '/@ ' FROM regexp_replace(
        regexp_replace(coalesce(p, ''), '^\s*(https?://)?(www\.|m\.)?(instagram\.com|facebook\.com|fb\.com)/', '', 'i'),
        '[?#].*$', '')), '')
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION "sales-pipe".is_valid_uk_postcode(p_pc text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
    SELECT upper(trim(coalesce(p_pc, ''))) ~ '^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$'
        OR trim(coalesce(p_pc, '')) ~ '^[1-9][0-9]{2}\s?[0-9]{3}$';
$$;

CREATE OR REPLACE FUNCTION "sales-pipe".type_category(p_type text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce(
    (SELECT c.category_group FROM "sales-pipe".business_categories c
     WHERE c.name = "sales-pipe".canonical_business_type(p_type)
       AND nullif(trim(coalesce(p_type, '')), '') IS NOT NULL),
    p_type
  )
$$;

CREATE OR REPLACE FUNCTION "sales-pipe".canonical_business_type(p_type text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH t AS (SELECT lower(trim(coalesce(p_type, ''))) AS clean),
  cats AS (
    SELECT c.name, c.slug, c.synonyms, c.sort_order
    FROM "sales-pipe".business_categories c
    WHERE c.is_active
  )
  SELECT coalesce(
    -- Name, slug or a known spelling
    (SELECT cats.name FROM cats, t
     WHERE t.clean <> '' AND (lower(cats.name) = t.clean OR cats.slug = t.clean OR t.clean = ANY(cats.synonyms))
     ORDER BY cats.sort_order LIMIT 1),
    -- A known spelling as a whole word inside it ("The Crown Hotel & Spa")
    (SELECT cats.name FROM cats, t, unnest(cats.synonyms) AS w
     WHERE t.clean <> '' AND length(w) >= 3
       AND t.clean ~ ('\m' || regexp_replace(w, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '\M')
     ORDER BY length(w) DESC, cats.sort_order LIMIT 1),
    -- Nothing matched
    (SELECT ps.value #>> '{}' FROM "sales-pipe".pipeline_settings ps WHERE ps.key = 'default_business_category')
  )
$$;

CREATE OR REPLACE FUNCTION "sales-pipe".check_opp_access(p_opportunity_id uuid)
RETURNS void AS $$
DECLARE
    v_role text := "sales-pipe".get_user_role();
    v_opp record;
    v_uid uuid := auth.uid();
BEGIN
    IF v_role = 'admin' OR auth.role() = 'service_role' THEN RETURN; END IF;
    SELECT * INTO v_opp FROM "sales-pipe".opportunities WHERE id = p_opportunity_id;
    IF v_opp.id IS NULL THEN RAISE EXCEPTION 'Pitch not found'; END IF;
    IF v_uid = v_opp.assigned_consultant_id THEN RETURN; END IF;
    IF v_uid = v_opp.assigned_sales_id THEN
        IF v_opp.assigned_consultant_id IS NOT NULL AND v_opp.stage = 'Consultation' THEN
            RAISE EXCEPTION 'This business has been handed over to a consultant';
        END IF;
        RETURN;
    END IF;
    IF v_role IN ('sales', 'consultant') AND v_opp.assigned_sales_id IS NULL AND v_opp.assigned_consultant_id IS NULL THEN
        RETURN;
    END IF;
    RAISE EXCEPTION 'You are not assigned to this business';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'sales-pipe', 'public';

CREATE OR REPLACE FUNCTION "sales-pipe".compute_business_problems(b "sales-pipe".businesses)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'sales-pipe', 'public' AS $$
DECLARE
    v_problems text[] := '{}';
    v_has_contact boolean := false;
BEGIN
    IF coalesce(trim(b.business_name), '') = '' THEN
        v_problems := array_append(v_problems, 'name');
    END IF;
    IF b.business_type IS NULL OR b.business_type NOT IN ('Hotel', 'Restaurant or cafe', 'Pub', 'Property management') THEN
        v_problems := array_append(v_problems, 'category');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM "sales-pipe".opportunities o
        WHERE o.business_id = b.id
          AND array_length(o.services_pitched, 1) > 0
          AND o.services_pitched <@ "sales-pipe".valid_services()
    ) THEN
        v_problems := array_append(v_problems, 'service');
    END IF;
    IF coalesce(trim(b.email), '') ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'
       OR coalesce(trim(b.whatsapp_number), '') <> ''
       OR coalesce(trim(b.instagram), '') <> ''
       OR coalesce(trim(b.facebook), '') <> ''
       OR coalesce(trim(b.linkedin), '') <> ''
       OR coalesce(trim(b.owner_contact), '') <> ''
       OR coalesce(trim(b.owner_email), '') <> '' THEN
        v_has_contact := true;
    END IF;
    IF NOT v_has_contact THEN
        v_problems := array_append(v_problems, 'business_contact');
    END IF;
    RETURN v_problems;
END;
$$;

CREATE OR REPLACE FUNCTION "sales-pipe".lead_problems(p_business_id uuid)
RETURNS text[] AS $$
DECLARE
    b "sales-pipe".businesses;
BEGIN
    SELECT * INTO b FROM "sales-pipe".businesses WHERE id = p_business_id;
    IF b.id IS NULL THEN RETURN '{}'::text[]; END IF;
    RETURN "sales-pipe".compute_business_problems(b);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

CREATE OR REPLACE FUNCTION "sales-pipe".trg_businesses_compute_problems()
RETURNS trigger AS $$
BEGIN
    NEW.problems := "sales-pipe".compute_business_problems(NEW);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

DROP TRIGGER IF EXISTS trg_businesses_compute_problems ON "sales-pipe".businesses;
CREATE TRIGGER trg_businesses_compute_problems
    BEFORE INSERT OR UPDATE ON "sales-pipe".businesses
    FOR EACH ROW EXECUTE FUNCTION "sales-pipe".trg_businesses_compute_problems();

CREATE OR REPLACE FUNCTION "sales-pipe".trg_opp_services_recompute_problems()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.services_pitched IS NOT DISTINCT FROM NEW.services_pitched THEN
        RETURN NEW;
    END IF;
    UPDATE "sales-pipe".businesses
    SET problems = "sales-pipe".lead_problems(NEW.business_id)
    WHERE id = NEW.business_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

DROP TRIGGER IF EXISTS trg_opp_services_recompute_problems ON "sales-pipe".opportunities;
CREATE TRIGGER trg_opp_services_recompute_problems
    AFTER INSERT OR UPDATE OF services_pitched ON "sales-pipe".opportunities
    FOR EACH ROW EXECUTE FUNCTION "sales-pipe".trg_opp_services_recompute_problems();

-- update_lead_field
CREATE OR REPLACE FUNCTION "sales-pipe".update_lead_field(p_business_id uuid, p_field text, p_value text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'sales-pipe', 'public' AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
    v_field text := lower(trim(p_field));
    v_val text := trim(coalesce(p_value, ''));
    v_clean_val text := nullif(v_val, '');
    v_services text[];
    v_new_problems text[];
    v_tp_type text;
    v_tp_name text;
BEGIN
    IF v_role IS NULL AND auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Your account is not set up'; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM "sales-pipe".opportunities o
        WHERE o.business_id = p_business_id
          AND (v_role = 'admin' OR auth.role() = 'service_role'
               OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
               OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
    ) THEN RAISE EXCEPTION 'You cannot edit this business'; END IF;

    IF v_field IN ('business_name', 'name') THEN
        UPDATE "sales-pipe".businesses SET business_name = coalesce(v_clean_val, '') WHERE id = p_business_id;
    ELSIF v_field IN ('business_type', 'category') THEN
        IF v_clean_val NOT IN ('Hotel', 'Restaurant or cafe', 'Pub', 'Property management') THEN
            RAISE EXCEPTION 'Category must be Hotel, Restaurant or cafe, Pub, or Property management';
        END IF;
        UPDATE "sales-pipe".businesses SET business_type = v_clean_val, category = "sales-pipe".type_category(v_clean_val) WHERE id = p_business_id;
    ELSIF v_field = 'existing_website' OR v_field = 'website' THEN
        UPDATE "sales-pipe".businesses SET existing_website = v_clean_val, has_no_website = false WHERE id = p_business_id;
    ELSIF v_field IN ('has_no_website', 'no_site') THEN
        UPDATE "sales-pipe".businesses
        SET has_no_website = coalesce(v_val::boolean, false),
            existing_website = CASE WHEN coalesce(v_val::boolean, false) THEN NULL ELSE existing_website END
        WHERE id = p_business_id;
    ELSIF v_field = 'address' THEN
        UPDATE "sales-pipe".businesses SET address = v_clean_val WHERE id = p_business_id;
    ELSIF v_field = 'postcode' THEN
        UPDATE "sales-pipe".businesses SET postcode = upper(v_clean_val) WHERE id = p_business_id;
    ELSIF v_field IN ('services', 'services_pitched') THEN
        v_services := ARRAY(SELECT trim(s) FROM unnest(string_to_array(v_val, ',')) s WHERE trim(s) <> '' AND trim(s) = ANY("sales-pipe".valid_services()));
        UPDATE "sales-pipe".opportunities SET services_pitched = v_services WHERE business_id = p_business_id;
    ELSIF v_field IN ('contact_name', 'owner_name') THEN
        UPDATE "sales-pipe".businesses SET contact_name = v_clean_val WHERE id = p_business_id;
    ELSIF v_field = 'owner_email' THEN
        UPDATE "sales-pipe".businesses SET owner_email = lower(v_clean_val) WHERE id = p_business_id;
    ELSIF v_field = 'owner_contact' THEN
        UPDATE "sales-pipe".businesses SET owner_contact = v_clean_val,
            owner_email = CASE WHEN v_clean_val ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' THEN lower(v_clean_val) ELSE owner_email END
        WHERE id = p_business_id;
    ELSIF v_field = 'email' THEN
        UPDATE "sales-pipe".businesses SET email = lower(v_clean_val) WHERE id = p_business_id;
    ELSIF v_field = 'whatsapp_number' THEN
        UPDATE "sales-pipe".businesses SET whatsapp_number = v_clean_val WHERE id = p_business_id;
    ELSIF v_field = 'instagram' THEN
        UPDATE "sales-pipe".businesses SET instagram = "sales-pipe".clean_handle(v_clean_val) WHERE id = p_business_id;
    ELSIF v_field = 'facebook' THEN
        UPDATE "sales-pipe".businesses SET facebook = "sales-pipe".clean_handle(v_clean_val) WHERE id = p_business_id;
    ELSIF v_field = 'linkedin' THEN
        UPDATE "sales-pipe".businesses SET linkedin = v_clean_val WHERE id = p_business_id;
    ELSIF v_field = 'tech_partner_type' THEN
        IF v_clean_val NOT IN ('Agency', 'DIY', 'None') THEN RAISE EXCEPTION 'Tech partner type must be Agency, DIY, or None'; END IF;
        UPDATE "sales-pipe".businesses SET tech_partner_type = v_clean_val, tech_partner_name = CASE WHEN v_clean_val = 'None' THEN NULL ELSE tech_partner_name END WHERE id = p_business_id;
    ELSIF v_field IN ('tech_partner', 'existing_tech_partner') THEN
        IF v_clean_val IS NOT NULL THEN
            IF lower(v_clean_val) = 'none' THEN v_tp_type := 'None'; v_tp_name := NULL;
            ELSIF v_clean_val ~* '^Agency' THEN v_tp_type := 'Agency'; v_tp_name := nullif(btrim(regexp_replace(v_clean_val, '^Agency\s*', '', 'i'), ' ()'), ''); IF v_tp_name IS NULL THEN v_tp_name := 'Agency'; END IF;
            ELSIF v_clean_val ~* '^DIY' THEN v_tp_type := 'DIY'; v_tp_name := nullif(btrim(regexp_replace(v_clean_val, '^DIY\s*', '', 'i'), ' ()'), ''); IF v_tp_name IS NULL THEN v_tp_name := 'DIY'; END IF;
            ELSE v_tp_type := 'Agency'; v_tp_name := v_clean_val; END IF;
        END IF;
        UPDATE "sales-pipe".businesses SET tech_partner_type = coalesce(v_tp_type, tech_partner_type), tech_partner_name = CASE WHEN v_tp_type = 'None' THEN NULL ELSE coalesce(v_tp_name, tech_partner_name) END WHERE id = p_business_id;
    ELSIF v_field IN ('gaps_found', 'gaps') THEN
        UPDATE "sales-pipe".businesses SET gaps_found = v_clean_val WHERE id = p_business_id;
    ELSIF v_field = 'source' THEN
        UPDATE "sales-pipe".businesses SET source = v_clean_val WHERE id = p_business_id;
    ELSE RAISE EXCEPTION 'Unsupported field: %', p_field; END IF;

    v_new_problems := "sales-pipe".lead_problems(p_business_id);
    UPDATE "sales-pipe".businesses SET problems = v_new_problems WHERE id = p_business_id;

    RETURN jsonb_build_object('ok', true, 'business_id', p_business_id, 'field', v_field, 'problems', to_jsonb(v_new_problems));
END;
$$;
GRANT EXECUTE ON FUNCTION "sales-pipe".update_lead_field(uuid, text, text) TO authenticated, service_role;

-- missing_counts
CREATE OR REPLACE FUNCTION "sales-pipe".missing_counts(p_type text DEFAULT NULL::text, p_problem text DEFAULT NULL::text, p_batch uuid DEFAULT NULL::uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'sales-pipe', 'public' AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
    v_result jsonb;
BEGIN
    IF v_role IS NULL AND auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Your account is not set up'; END IF;
    WITH base AS (
        SELECT b.id, b.business_type, b.problems FROM "sales-pipe".businesses b
        JOIN "sales-pipe".opportunities o ON o.business_id = b.id
        WHERE o.stage = 'Needs review' AND b.problems <> '{}'::text[] AND NOT b.archived
          AND (v_role = 'admin' OR auth.role() = 'service_role' OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
               OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
          AND (p_batch IS NULL OR b.import_batch_id = p_batch)
    ),
    type_counts AS (
        SELECT coalesce(jsonb_agg(jsonb_build_object('business_type', t.cat, 'count', coalesce(cnt.c, 0))
               ORDER BY array_position(ARRAY['Hotel', 'Restaurant or cafe', 'Pub', 'Property management'], t.cat)), '[]'::jsonb) AS js
        FROM unnest(ARRAY['Hotel', 'Restaurant or cafe', 'Pub', 'Property management']) AS t(cat)
        LEFT JOIN (SELECT b.business_type, count(b.id)::int AS c FROM base b WHERE (nullif(p_problem, '') IS NULL OR p_problem = ANY(b.problems)) GROUP BY b.business_type) cnt ON cnt.business_type = t.cat
    ),
    prob_counts AS (
        SELECT coalesce(jsonb_agg(jsonb_build_object('problem', p.code, 'label', p.label, 'count', coalesce(cnt.c, 0))), '[]'::jsonb) AS js
        FROM (VALUES ('name', 'Business name'), ('website', 'Website'), ('location', 'Location'), ('postcode', 'Postcode'), ('category', 'Category'), ('service', 'Service'), ('owner_name', 'Owner name'), ('owner_contact', 'Owner contact'), ('business_contact', 'Business contact'), ('tech_partner', 'Tech partner'), ('gaps', 'Gaps found')) AS p(code, label)
        LEFT JOIN (SELECT unnest(b.problems) AS prob, count(b.id)::int AS c FROM base b WHERE (nullif(p_type, '') IS NULL OR b.business_type = p_type) GROUP BY prob) cnt ON cnt.prob = p.code
    )
    SELECT jsonb_build_object('total_missing', (SELECT count(*) FROM base), 'by_type', (SELECT js FROM type_counts), 'by_problem', (SELECT js FROM prob_counts)) INTO v_result;
    RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION "sales-pipe".missing_counts(text, text, uuid) TO authenticated, service_role;

-- missing_list
CREATE OR REPLACE FUNCTION "sales-pipe".missing_list(
    p_type text DEFAULT NULL::text, p_problem text DEFAULT NULL::text, p_batch uuid DEFAULT NULL::uuid,
    p_limit integer DEFAULT 50, p_offset integer DEFAULT 0
)
RETURNS TABLE(
    opportunity_id uuid, business_id uuid, business_name text, business_type text, existing_website text, has_no_website boolean,
    address text, postcode text, branches jsonb, services text[], contact_name text, owner_email text, owner_contact text,
    email text, whatsapp_number text, instagram text, facebook text, linkedin text, tech_partner_type text, tech_partner_name text,
    gaps_found text, source text, import_batch_id uuid, batch_file_name text, batch_uploaded_at timestamp with time zone,
    problems text[], total_count bigint
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'sales-pipe', 'public' AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
BEGIN
    IF v_role IS NULL AND auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Your account is not set up'; END IF;
    RETURN QUERY
    WITH rows AS (
        SELECT o.id AS r_opportunity_id, b.id AS r_business_id, b.business_name AS r_business_name, b.business_type AS r_business_type,
            b.existing_website AS r_existing_website, coalesce(b.has_no_website, false) AS r_has_no_website, b.address AS r_address,
            b.postcode AS r_postcode, coalesce(b.branches, '[]'::jsonb) AS r_branches, o.services_pitched AS r_services,
            b.contact_name AS r_contact_name, b.owner_email AS r_owner_email, b.owner_contact AS r_owner_contact, b.email AS r_email,
            b.whatsapp_number AS r_whatsapp_number, b.instagram AS r_instagram, b.facebook AS r_facebook, b.linkedin AS r_linkedin,
            b.tech_partner_type AS r_tech_partner_type, b.tech_partner_name AS r_tech_partner_name, b.gaps_found AS r_gaps_found,
            b.source AS r_source, b.import_batch_id AS r_import_batch_id, ib.file_name AS r_batch_file_name, ib.created_at AS r_batch_uploaded_at,
            b.problems AS r_problems
        FROM "sales-pipe".businesses b
        JOIN "sales-pipe".opportunities o ON o.business_id = b.id
        LEFT JOIN "sales-pipe".import_batches ib ON ib.id = b.import_batch_id
        WHERE o.stage = 'Needs review' AND b.problems <> '{}'::text[] AND NOT b.archived
          AND (v_role = 'admin' OR auth.role() = 'service_role' OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
               OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
          AND (nullif(p_type, '') IS NULL OR b.business_type = p_type)
          AND (nullif(p_problem, '') IS NULL OR p_problem = ANY(b.problems))
          AND (p_batch IS NULL OR b.import_batch_id = p_batch)
    )
    SELECT r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type, r.r_existing_website, r.r_has_no_website,
        r.r_address, r.r_postcode, r.r_branches, r.r_services, r.r_contact_name, r.r_owner_email, r.r_owner_contact,
        r.r_email, r.r_whatsapp_number, r.r_instagram, r.r_facebook, r.r_linkedin, r.r_tech_partner_type, r.r_tech_partner_name,
        r.r_gaps_found, r.r_source, r.r_import_batch_id, r.r_batch_file_name, r.r_batch_uploaded_at, r.r_problems,
        count(*) OVER () AS total_count
    FROM rows r
    ORDER BY r.r_business_name ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$;
GRANT EXECUTE ON FUNCTION "sales-pipe".missing_list(text, text, uuid, integer, integer) TO authenticated, service_role;

-- bulk_set_field
CREATE OR REPLACE FUNCTION "sales-pipe".bulk_set_field(p_business_ids uuid[], p_field text, p_value text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'sales-pipe', 'public' AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
    v_field text := lower(trim(p_field));
    v_val text := trim(coalesce(p_value, ''));
    v_services text[];
    v_count int := 0;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales', 'consultant']);
    IF v_field IN ('services', 'service', 'services_pitched') THEN
        SELECT coalesce(array_agg(DISTINCT trim(s)) FILTER (WHERE trim(s) <> ''), '{}') INTO v_services
        FROM unnest(string_to_array(replace(v_val, ';', ','), ',')) s;
        SELECT coalesce(array_agg(s), '{}') INTO v_services FROM unnest(v_services) s WHERE s = ANY("sales-pipe".valid_services());
        IF array_length(v_services, 1) IS NULL THEN RAISE EXCEPTION 'Pick at least one valid service'; END IF;
        UPDATE "sales-pipe".opportunities o SET services_pitched = v_services
        WHERE o.business_id = ANY(p_business_ids) AND o.stage = 'Needs review'
          AND (v_role = 'admin' OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
               OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL));
        GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSIF v_field IN ('category', 'business_type') THEN
        IF v_val NOT IN ('Hotel', 'Restaurant or cafe', 'Pub', 'Property management') THEN v_val := "sales-pipe".canonical_business_type(v_val); END IF;
        IF v_val IS NULL THEN RAISE EXCEPTION 'Invalid category'; END IF;
        UPDATE "sales-pipe".businesses b SET business_type = v_val, category = "sales-pipe".type_category(v_val)
        WHERE b.id = ANY(p_business_ids)
          AND EXISTS (SELECT 1 FROM "sales-pipe".opportunities o WHERE o.business_id = b.id
                      AND (v_role = 'admin' OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
                           OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)));
        GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSIF v_field = 'source' THEN
        UPDATE "sales-pipe".businesses b SET source = nullif(v_val, '')
        WHERE b.id = ANY(p_business_ids)
          AND EXISTS (SELECT 1 FROM "sales-pipe".opportunities o WHERE o.business_id = b.id
                      AND (v_role = 'admin' OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
                           OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)));
        GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE RAISE EXCEPTION 'Bulk set not supported for %', p_field; END IF;
    PERFORM "sales-pipe".lead_problems(b_id) FROM unnest(p_business_ids) AS b_id;
    RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION "sales-pipe".bulk_set_field(uuid[], text, text) TO authenticated, service_role;

-- delete_leads
CREATE OR REPLACE FUNCTION "sales-pipe".delete_leads(p_business_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'sales-pipe', 'public' AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
    v_count int := 0;
    v_bid uuid;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales', 'consultant']);
    FOR v_bid IN
        SELECT b.id FROM "sales-pipe".businesses b
        JOIN "sales-pipe".opportunities o ON o.business_id = b.id
        LEFT JOIN "sales-pipe".import_batches ib ON ib.id = b.import_batch_id
        WHERE b.id = ANY(p_business_ids) AND o.stage = 'Needs review'
          AND NOT EXISTS (SELECT 1 FROM "sales-pipe".threads t JOIN "sales-pipe".messages m ON m.thread_id = t.id WHERE t.opportunity_id = o.id)
          AND (v_role = 'admin' OR ib.uploaded_by = v_uid OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
               OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL))
    LOOP
        DELETE FROM "sales-pipe".businesses WHERE id = v_bid;
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION "sales-pipe".delete_leads(uuid[]) TO authenticated, service_role;

-- approve_import
CREATE OR REPLACE FUNCTION "sales-pipe".approve_import(p_business_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'sales-pipe', 'public' AS $$
DECLARE
    b record; opp record; platforms text[]; p text;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales', 'consultant']);
    FOR b IN SELECT id, business_name, problems FROM "sales-pipe".businesses WHERE id = ANY(p_business_ids) AND NOT archived LOOP
        IF array_length(b.problems, 1) > 0 THEN RAISE EXCEPTION 'Fix missing data first for %', b.business_name; END IF;
    END LOOP;
    FOR b IN SELECT * FROM "sales-pipe".businesses WHERE id = ANY(p_business_ids) AND NOT archived LOOP
        FOR opp IN SELECT * FROM "sales-pipe".opportunities WHERE business_id = b.id AND stage = 'Needs review' LOOP
            PERFORM "sales-pipe".check_opp_access(opp.id);
            platforms := '{}';
            IF b.email IS NOT NULL THEN platforms := array_append(platforms, 'Email'); END IF;
            IF coalesce(b.whatsapp_number, '') <> '' THEN platforms := array_append(platforms, 'WhatsApp'); END IF;
            IF b.instagram IS NOT NULL THEN platforms := array_append(platforms, 'Instagram'); END IF;
            IF b.facebook IS NOT NULL THEN platforms := array_append(platforms, 'Facebook'); END IF;
            IF b.linkedin IS NOT NULL THEN platforms := array_append(platforms, 'LinkedIn'); END IF;
            IF array_length(platforms, 1) IS NULL THEN platforms := ARRAY['Walk-in']; END IF;
            FOREACH p IN ARRAY platforms LOOP
                INSERT INTO "sales-pipe".threads (opportunity_id, platform, status)
                VALUES (opp.id, p, 'open') ON CONFLICT DO NOTHING;
            END LOOP;
            UPDATE "sales-pipe".opportunities SET stage = 'Identified', stage_entered_at = now() WHERE id = opp.id;
        END LOOP;
    END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION "sales-pipe".approve_import(uuid[]) TO authenticated, service_role;

-- import_businesses
CREATE OR REPLACE FUNCTION "sales-pipe".import_businesses(p_rows jsonb, p_batch_id uuid DEFAULT NULL::uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'sales-pipe', 'public' AS $$
DECLARE
    x jsonb; v_bid uuid; v_action text; v_name text; v_type text; v_services text[];
    v_tech_type text; v_tech_name text; v_branches jsonb; v_raw_branches text;
    v_ready int := 0; v_missing int := 0; v_skipped int := 0; v_probs text[];
    b_str text; v_raw_services text; v_raw_tp text; v_site text;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales', 'consultant']);
    FOR x IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
        v_action := coalesce(x->>'action', 'new');
        v_name := trim(coalesce(x->>'business_name', ''));
        IF v_action = 'skip' THEN v_skipped := v_skipped + 1; CONTINUE; END IF;
        IF v_action IN ('new', 'update') THEN
            IF x->'services' IS NOT NULL AND jsonb_typeof(x->'services') = 'array' THEN
                SELECT coalesce(array_agg(trim(val)), '{}'::text[]) INTO v_services FROM jsonb_array_elements_text(x->'services') val WHERE trim(val) = ANY("sales-pipe".valid_services());
            ELSIF x->'services_pitched' IS NOT NULL AND jsonb_typeof(x->'services_pitched') = 'array' THEN
                SELECT coalesce(array_agg(trim(val)), '{}'::text[]) INTO v_services FROM jsonb_array_elements_text(x->'services_pitched') val WHERE trim(val) = ANY("sales-pipe".valid_services());
            ELSE
                v_raw_services := trim(coalesce(x->>'services', x->>'services_pitched', ''));
                SELECT coalesce(array_agg(trim(s)), '{}'::text[]) INTO v_services FROM unnest(string_to_array(v_raw_services, ',')) s WHERE trim(s) = ANY("sales-pipe".valid_services());
            END IF;
            IF v_services IS NULL THEN v_services := '{}'::text[]; END IF;

            v_type := nullif(trim(x->>'business_type'), '');
            IF v_type IS NOT NULL AND v_type NOT IN ('Hotel', 'Restaurant or cafe', 'Pub', 'Property management') THEN
                v_type := "sales-pipe".canonical_business_type(v_type);
            END IF;

            v_site := nullif(trim(x->>'existing_website'), '');
            IF v_site IS NOT NULL AND v_site !~* '^https?://' AND v_site ~* '^[^\s.]+\.[^\s]{2,}' THEN
                v_site := 'https://' || v_site;
            END IF;

            v_tech_type := nullif(trim(x->>'tech_partner_type'), '');
            v_raw_tp := nullif(trim(coalesce(x->>'tech_partner', x->>'existing_tech_partner', '')), '');
            IF v_tech_type IS NULL AND v_raw_tp IS NOT NULL THEN
                IF lower(v_raw_tp) = 'none' THEN v_tech_type := 'None'; v_tech_name := NULL;
                ELSIF v_raw_tp ~* '^Agency' THEN v_tech_type := 'Agency'; v_tech_name := nullif(btrim(regexp_replace(v_raw_tp, '^Agency\s*', '', 'i'), ' ()'), '');
                ELSIF v_raw_tp ~* '^DIY' THEN v_tech_type := 'DIY'; v_tech_name := nullif(btrim(regexp_replace(v_raw_tp, '^DIY\s*', '', 'i'), ' ()'), '');
                ELSE v_tech_type := 'Agency'; v_tech_name := v_raw_tp; END IF;
            END IF;
            IF v_tech_type IS NOT NULL AND v_tech_type NOT IN ('Agency', 'DIY', 'None') THEN v_tech_type := NULL; END IF;
            IF v_tech_name IS NULL THEN v_tech_name := nullif(trim(x->>'tech_partner_name'), ''); END IF;

            v_branches := '[]'::jsonb;
            IF x->'branches' IS NOT NULL AND jsonb_typeof(x->'branches') = 'array' THEN v_branches := x->'branches';
            ELSE
                v_raw_branches := trim(coalesce(x->>'branches', ''));
                IF v_raw_branches <> '' THEN
                    FOR b_str IN SELECT trim(b) FROM unnest(string_to_array(v_raw_branches, ';')) b LOOP
                        v_branches := v_branches || jsonb_build_object('name', b_str, 'address', b_str, 'postcode', '');
                    END LOOP;
                END IF;
            END IF;

            IF v_action = 'new' THEN
                INSERT INTO "sales-pipe".businesses (
                    business_name, business_type, category, existing_website, has_no_website,
                    address, postcode, branches, contact_name, owner_email, owner_contact,
                    email, whatsapp_number, instagram, facebook, linkedin,
                    tech_partner_type, tech_partner_name, gaps_found, source, import_batch_id
                ) VALUES (
                    v_name, coalesce(v_type, 'Restaurant or cafe'), "sales-pipe".type_category(coalesce(v_type, 'Restaurant or cafe')),
                    v_site, coalesce((x->>'has_no_website')::boolean, (x->>'no_site')::boolean, false),
                    nullif(trim(x->>'address'), ''), nullif(trim(x->>'postcode'), ''), v_branches,
                    nullif(trim(x->>'contact_name'), ''), nullif(trim(x->>'owner_email'), ''),
                    nullif(trim(coalesce(x->>'owner_contact', x->>'owner_whatsapp', '')), ''),
                    nullif(trim(x->>'email'), ''), nullif(trim(x->>'whatsapp_number'), ''),
                    "sales-pipe".clean_handle(x->>'instagram'), "sales-pipe".clean_handle(x->>'facebook'),
                    nullif(trim(x->>'linkedin'), ''), v_tech_type, v_tech_name,
                    nullif(trim(x->>'gaps_found'), ''), nullif(trim(x->>'source'), ''), p_batch_id
                ) RETURNING id INTO v_bid;

                INSERT INTO "sales-pipe".opportunities (business_id, stage, services_pitched)
                VALUES (v_bid, 'Needs review', v_services);

                UPDATE "sales-pipe".businesses SET problems = "sales-pipe".lead_problems(v_bid)
                WHERE id = v_bid RETURNING problems INTO v_probs;

                IF array_length(v_probs, 1) > 0 THEN v_missing := v_missing + 1; ELSE v_ready := v_ready + 1; END IF;
            END IF;
        END IF;
    END LOOP;
    RETURN jsonb_build_object('ready', v_ready, 'missing', v_missing, 'skipped', v_skipped);
END;
$$;
GRANT EXECUTE ON FUNCTION "sales-pipe".import_businesses(jsonb, uuid) TO authenticated, service_role;

-- list_pitches
CREATE OR REPLACE FUNCTION "sales-pipe".list_pitches(
    p_service text DEFAULT NULL::text, p_type text DEFAULT NULL::text, p_filter text DEFAULT 'all'::text,
    p_search text DEFAULT NULL::text, p_platform text DEFAULT NULL::text, p_assigned text DEFAULT NULL::text,
    p_include_archived boolean DEFAULT false, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0
)
RETURNS TABLE(
    opportunity_id uuid, business_id uuid, business_name text, business_type text, area text, postcode text,
    address text, google_rating numeric, phone text, email text, instagram text, facebook text,
    company_type text, contact_name text, archived boolean, stage text, services_pitched text[],
    services_won text[], assigned_sales_id uuid, assigned_sales_name text, assigned_consultant_name text,
    consultation_at timestamp with time zone, created_at timestamp with time zone, threads jsonb,
    next_due_on date, needs_reply boolean, total_count bigint, existing_website text, has_no_website boolean,
    whatsapp_number text, owner_contact text, owner_email text, tech_partner_type text, tech_partner_name text, gaps_found text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'sales-pipe', 'public' AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
BEGIN
    IF v_role IS NULL AND auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Your account is not set up'; END IF;
    RETURN QUERY
    WITH base AS (
        SELECT o.*, b.business_name AS b_name, b.business_type AS b_type, b.area AS b_area, b.postcode AS b_pc,
               b.address AS b_address, b.google_rating AS b_rating, coalesce(b.whatsapp_number, b.phone) AS b_phone,
               b.email AS b_email, b.instagram AS b_ig, b.facebook AS b_fb, b.company_type AS b_ct, b.contact_name AS b_contact,
               b.archived AS b_archived, b.existing_website AS b_website, coalesce(b.has_no_website, false) AS b_no_website,
               b.whatsapp_number AS b_whatsapp, b.owner_contact AS b_owner_contact, b.owner_email AS b_owner_email,
               b.tech_partner_type AS b_tech_type, b.tech_partner_name AS b_tech_name, b.gaps_found AS b_gaps,
               EXISTS (SELECT 1 FROM "sales-pipe".threads t WHERE t.opportunity_id = o.id AND t.status = 'Replied'
                       AND t.last_message_at > coalesce(o.stage_entered_at, '-infinity'))
               AND o.stage IN ('Identified', 'Outreach sent', 'Follow-up 1', 'Follow-up 2') AS b_needs_reply
        FROM "sales-pipe".opportunities o
        JOIN "sales-pipe".businesses b ON b.id = o.business_id
        WHERE (p_include_archived OR NOT b.archived)
          AND (v_role = 'admin' OR auth.role() = 'service_role' OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
               OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
          AND (nullif(p_service, '') IS NULL OR p_service = ANY(o.services_pitched))
          AND (nullif(p_type, '') IS NULL OR b.business_type = p_type OR b.business_type = "sales-pipe".canonical_business_type(p_type))
          AND (nullif(p_search, '') IS NULL OR b.business_name ILIKE '%' || p_search || '%' OR b.area ILIKE '%' || p_search || '%'
               OR b.postcode ILIKE '%' || p_search || '%' OR b.email ILIKE '%' || p_search || '%')
          AND (nullif(p_platform, '') IS NULL OR EXISTS (SELECT 1 FROM "sales-pipe".threads t WHERE t.opportunity_id = o.id AND t.platform = p_platform))
          AND (nullif(p_assigned, '') IS NULL OR (p_assigned = 'me' AND (o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid))
               OR (p_assigned = 'unassigned' AND o.assigned_sales_id IS NULL)
               OR (p_assigned NOT IN ('me', 'unassigned') AND (o.assigned_sales_id::text = p_assigned OR o.assigned_consultant_id::text = p_assigned)))
    ),
    filtered AS (
        SELECT * FROM base
        WHERE coalesce(p_filter, 'all') = 'all'
           OR (p_filter = 'needs-reply' AND base.b_needs_reply)
           OR (p_filter = 'needs-consultant' AND base.stage = 'Call booked' AND base.assigned_consultant_id IS NULL)
           OR (p_filter = 'open' AND base.stage IN ('Identified', 'Outreach sent', 'Follow-up 1', 'Follow-up 2', 'Replied - positive'))
           OR (p_filter = 'Needs review' AND base.stage = 'Needs review' AND EXISTS (SELECT 1 FROM "sales-pipe".businesses b WHERE b.id = base.business_id AND b.problems = '{}'::text[]))
           OR (p_filter NOT IN ('Needs review', 'needs-reply', 'needs-consultant', 'open', 'all') AND base.stage = p_filter)
    )
    SELECT f.id, f.business_id, f.b_name, f.b_type, f.b_area, f.b_pc, f.b_address, f.b_rating, f.b_phone, f.b_email,
           f.b_ig, f.b_fb, f.b_ct, f.b_contact, f.b_archived, f.stage, f.services_pitched, CAST(NULL AS text[]),
           f.assigned_sales_id,
           (SELECT full_name FROM "sales-pipe".profiles WHERE id = f.assigned_sales_id),
           (SELECT full_name FROM "sales-pipe".profiles WHERE id = f.assigned_consultant_id),
           CAST(NULL AS timestamptz), f.created_at,
           coalesce((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'platform', t.platform, 'status', t.status, 'unread_count', t.unread_count, 'last_message_at', t.last_message_at)
                      ORDER BY array_position(ARRAY['WhatsApp','Instagram','Facebook','Email','LinkedIn'], t.platform))
                     FROM "sales-pipe".threads t WHERE t.opportunity_id = f.id), '[]'::jsonb),
           CAST(NULL AS date), f.b_needs_reply, count(*) OVER (), f.b_website, f.b_no_website, f.b_whatsapp,
           f.b_owner_contact, f.b_owner_email, f.b_tech_type, f.b_tech_name, f.b_gaps
    FROM filtered f
    ORDER BY CASE WHEN p_filter = 'Needs review' THEN f.created_at END DESC, f.b_needs_reply DESC, f.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;
GRANT EXECUTE ON FUNCTION "sales-pipe".list_pitches(text, text, text, text, text, text, boolean, integer, integer) TO authenticated, service_role;

-- 43. enqueue_campaign: staff launch a campaign
CREATE OR REPLACE FUNCTION "sales-pipe".enqueue_campaign(p_channel text, p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v_status text;
    v_recipients jsonb;
    v_total int;
    v_queued int;
    v_skipped int;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales', 'consultant']);

    IF p_channel = 'email' THEN
        SELECT status, recipients INTO v_status, v_recipients
        FROM "sales-pipe".email_campaigns WHERE id = p_campaign_id FOR UPDATE;
    ELSIF p_channel = 'whatsapp' THEN
        SELECT status, recipients INTO v_status, v_recipients
        FROM "sales-pipe".whatsapp_campaigns WHERE id = p_campaign_id FOR UPDATE;
    ELSE
        RAISE EXCEPTION 'Unknown campaign channel: %', p_channel;
    END IF;

    IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found.'; END IF;
    IF v_status IN ('sending', 'sent') THEN RAISE EXCEPTION 'This campaign has already been launched.'; END IF;

    IF jsonb_typeof(v_recipients) = 'string' THEN
        v_recipients := (v_recipients #>> '{}')::jsonb;
    END IF;
    IF v_recipients IS NULL OR jsonb_typeof(v_recipients) <> 'array' THEN
        v_recipients := '[]'::jsonb;
    END IF;
    v_total := jsonb_array_length(v_recipients);

    IF p_channel = 'email' THEN
        WITH src AS (
            SELECT DISTINCT ON (lower(trim(r->>'email')))
                lower(trim(r->>'email')) AS email,
                nullif(trim(r->>'business_name'), '') AS business_name,
                nullif(trim(r->>'contact_name'), '') AS contact_name,
                CASE WHEN r->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                     THEN (r->>'id')::uuid END AS rid
            FROM jsonb_array_elements(v_recipients) r
            WHERE coalesce(trim(r->>'email'), '') ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
        ), ins AS (
            INSERT INTO "sales-pipe".campaign_recipients
                (channel, campaign_id, email, business_name, contact_name, business_id, status, error_detail)
            SELECT 'email', p_campaign_id, s.email, s.business_name, s.contact_name,
                   (SELECT b.id FROM "sales-pipe".businesses b WHERE b.id = s.rid),
                   CASE WHEN o.id IS NULL THEN 'queued' ELSE 'skipped' END,
                   CASE WHEN o.id IS NULL THEN NULL ELSE 'Opted out' END
            FROM src s
            LEFT JOIN LATERAL (
                SELECT id FROM "sales-pipe".opt_outs
                WHERE lower(identifier) = s.email AND lower(channel) IN ('all', 'email') LIMIT 1
            ) o ON true
            RETURNING status
        )
        SELECT count(*) FILTER (WHERE status = 'queued'), count(*) FILTER (WHERE status = 'skipped')
        INTO v_queued, v_skipped FROM ins;
    ELSE
        WITH src AS (
            SELECT DISTINCT ON (regexp_replace(r->>'whatsapp_number', '\D', '', 'g'))
                trim(r->>'whatsapp_number') AS phone,
                regexp_replace(r->>'whatsapp_number', '\D', '', 'g') AS digits,
                nullif(trim(r->>'business_name'), '') AS business_name,
                nullif(trim(r->>'contact_name'), '') AS contact_name,
                CASE WHEN r->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                     THEN (r->>'id')::uuid END AS rid
            FROM jsonb_array_elements(v_recipients) r
            WHERE length(regexp_replace(coalesce(r->>'whatsapp_number', ''), '\D', '', 'g')) >= 7
        ), ins AS (
            INSERT INTO "sales-pipe".campaign_recipients
                (channel, whatsapp_campaign_id, phone, business_name, contact_name, business_id, status, error_detail)
            SELECT 'whatsapp', p_campaign_id, s.phone, s.business_name, s.contact_name,
                   (SELECT b.id FROM "sales-pipe".businesses b WHERE b.id = s.rid),
                   CASE WHEN o.id IS NULL THEN 'queued' ELSE 'skipped' END,
                   CASE WHEN o.id IS NULL THEN NULL ELSE 'Opted out' END
            FROM src s
            LEFT JOIN LATERAL (
                SELECT id FROM "sales-pipe".opt_outs
                WHERE regexp_replace(identifier, '\D', '', 'g') = s.digits AND lower(channel) IN ('all', 'whatsapp') LIMIT 1
            ) o ON true
            RETURNING status
        )
        SELECT count(*) FILTER (WHERE status = 'queued'), count(*) FILTER (WHERE status = 'skipped')
        INTO v_queued, v_skipped FROM ins;
    END IF;

    IF v_queued = 0 THEN
        RAISE EXCEPTION '%', CASE WHEN v_skipped > 0
            THEN 'Every recipient in this list has opted out.'
            ELSE 'No valid recipients in this campaign.' END;
    END IF;

    IF p_channel = 'email' THEN
        UPDATE "sales-pipe".email_campaigns
        SET status = 'sending', recipient_count = v_queued, sent_at = NULL, updated_at = now()
        WHERE id = p_campaign_id;
    ELSE
        UPDATE "sales-pipe".whatsapp_campaigns
        SET status = 'sending', recipient_count = v_queued, sent_at = NULL, updated_at = now()
        WHERE id = p_campaign_id;
    END IF;

    RETURN jsonb_build_object(
        'queued', v_queued,
        'skipped', v_skipped,
        'removed', v_total - v_queued - v_skipped
    );
END;
$$;

-- 44. campaign_progress: live counts for the UI
CREATE OR REPLACE FUNCTION "sales-pipe".campaign_progress(p_channel text, p_campaign_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = "sales-pipe", public
AS $$
    WITH rows AS (
        SELECT * FROM "sales-pipe".campaign_recipients
        WHERE (p_channel = 'email' AND campaign_id = p_campaign_id)
           OR (p_channel = 'whatsapp' AND whatsapp_campaign_id = p_campaign_id)
    )
    SELECT jsonb_build_object(
        'status', CASE WHEN p_channel = 'email'
            THEN (SELECT status FROM "sales-pipe".email_campaigns WHERE id = p_campaign_id)
            ELSE (SELECT status FROM "sales-pipe".whatsapp_campaigns WHERE id = p_campaign_id) END,
        'total', (SELECT count(*) FROM rows WHERE status <> 'skipped'),
        'queued', (SELECT count(*) FROM rows WHERE status = 'queued'),
        'sending', (SELECT count(*) FROM rows WHERE status = 'sending'),
        'sent', (SELECT count(*) FROM rows WHERE status = 'sent'),
        'failed', (SELECT count(*) FROM rows WHERE status = 'failed'),
        'skipped', (SELECT count(*) FROM rows WHERE status = 'skipped'),
        'simulated', (SELECT count(*) FROM rows WHERE status = 'sent' AND simulated),
        'retrying', (SELECT count(*) FROM rows WHERE status = 'queued' AND attempts > 0),
        'delivered', (SELECT count(*) FROM rows WHERE delivery_status IN ('delivered', 'read')),
        'read', (SELECT count(*) FROM rows WHERE delivery_status = 'read'),
        'opened', (SELECT count(*) FROM rows WHERE opened_at IS NOT NULL),
        'clicked', (SELECT count(*) FROM rows WHERE clicked_at IS NOT NULL),
        'bounced', (SELECT count(*) FROM rows WHERE delivery_status IN ('bounced', 'complained')),
        'failures', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'to', coalesce(email, phone), 'name', business_name, 'error', error_detail) ORDER BY updated_at DESC)
            FROM (SELECT * FROM rows WHERE status IN ('failed', 'skipped') ORDER BY updated_at DESC LIMIT 50) f
        ), '[]'::jsonb)
    );
$$;

-- 45. retry_failed_campaign_sends: staff put failed rows back in the queue
CREATE OR REPLACE FUNCTION "sales-pipe".retry_failed_campaign_sends(p_channel text, p_campaign_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v_count int;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales', 'consultant']);

    UPDATE "sales-pipe".campaign_recipients
    SET status = 'queued', attempts = 0, next_attempt_at = now(), error_detail = NULL, locked_at = NULL, updated_at = now()
    WHERE status = 'failed'
      AND ((p_channel = 'email' AND campaign_id = p_campaign_id)
        OR (p_channel = 'whatsapp' AND whatsapp_campaign_id = p_campaign_id));
    GET DIAGNOSTICS v_count = ROW_COUNT;

    IF v_count > 0 THEN
        IF p_channel = 'email' THEN
            UPDATE "sales-pipe".email_campaigns SET status = 'sending', updated_at = now() WHERE id = p_campaign_id;
        ELSE
            UPDATE "sales-pipe".whatsapp_campaigns SET status = 'sending', updated_at = now() WHERE id = p_campaign_id;
        END IF;
    END IF;

    RETURN v_count;
END;
$$;

-- 46. claim_campaign_sends: worker takes next batch (service role only)
CREATE OR REPLACE FUNCTION "sales-pipe".claim_campaign_sends(p_limit int DEFAULT 10, p_campaign_id uuid DEFAULT NULL)
RETURNS TABLE (
    id uuid, channel text, campaign_id uuid, email text, phone text,
    business_name text, contact_name text, attempts int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
#variable_conflict use_column
BEGIN
    UPDATE "sales-pipe".campaign_recipients cr
    SET status = 'queued', locked_at = NULL, updated_at = now()
    WHERE cr.status = 'sending' AND cr.locked_at < now() - interval '5 minutes';

    RETURN QUERY
    WITH picked AS (
        SELECT q.id FROM "sales-pipe".campaign_recipients q
        WHERE q.status = 'queued' AND q.next_attempt_at <= now()
          AND (p_campaign_id IS NULL OR q.campaign_id = p_campaign_id OR q.whatsapp_campaign_id = p_campaign_id)
        ORDER BY q.next_attempt_at, q.created_at
        LIMIT greatest(1, least(p_limit, 50))
        FOR UPDATE SKIP LOCKED
    )
    UPDATE "sales-pipe".campaign_recipients cr
    SET status = 'sending', locked_at = now(), attempts = cr.attempts + 1, updated_at = now()
    FROM picked
    WHERE cr.id = picked.id
    RETURNING cr.id, cr.channel, coalesce(cr.campaign_id, cr.whatsapp_campaign_id),
              cr.email, cr.phone, cr.business_name, cr.contact_name, cr.attempts;
END;
$$;

-- 47. complete_campaign_sends: worker records results (service role only)
CREATE OR REPLACE FUNCTION "sales-pipe".complete_campaign_sends(p_results jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
BEGIN
    UPDATE "sales-pipe".campaign_recipients cr
    SET status = CASE
            WHEN r.ok THEN 'sent'
            WHEN coalesce(r.permanent, false) OR cr.attempts >= 3 THEN 'failed'
            ELSE 'queued' END,
        sent_at = CASE WHEN r.ok THEN now() ELSE cr.sent_at END,
        next_attempt_at = CASE
            WHEN r.ok THEN cr.next_attempt_at
            ELSE now() + interval '1 minute' * power(5, greatest(cr.attempts - 1, 0)) END,
        error_detail = CASE WHEN r.ok THEN NULL ELSE left(coalesce(r.error, 'Unknown error'), 500) END,
        external_message_id = coalesce(r.external_id, cr.external_message_id),
        simulated = coalesce(r.simulated, false),
        locked_at = NULL,
        updated_at = now()
    FROM jsonb_to_recordset(p_results) AS r(id uuid, ok boolean, error text, external_id text, simulated boolean, permanent boolean)
    WHERE cr.id = r.id AND cr.status = 'sending';

    UPDATE "sales-pipe".email_campaigns c
    SET status = 'sent', sent_at = now(), updated_at = now()
    WHERE c.status = 'sending'
      AND NOT EXISTS (SELECT 1 FROM "sales-pipe".campaign_recipients q
                      WHERE q.campaign_id = c.id AND q.status IN ('queued', 'sending'));

    UPDATE "sales-pipe".whatsapp_campaigns c
    SET status = 'sent', sent_at = now(), updated_at = now()
    WHERE c.status = 'sending'
      AND NOT EXISTS (SELECT 1 FROM "sales-pipe".campaign_recipients q
                      WHERE q.whatsapp_campaign_id = c.id AND q.status IN ('queued', 'sending'));
END;
$$;

REVOKE ALL ON FUNCTION "sales-pipe".enqueue_campaign(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION "sales-pipe".campaign_progress(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION "sales-pipe".retry_failed_campaign_sends(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION "sales-pipe".claim_campaign_sends(int, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "sales-pipe".complete_campaign_sends(jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION "sales-pipe".enqueue_campaign(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe".campaign_progress(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe".retry_failed_campaign_sends(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe".claim_campaign_sends(int, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe".complete_campaign_sends(jsonb) TO service_role;

-- 48. record_whatsapp_status: called by webhook for delivery receipts (service role only)
CREATE OR REPLACE FUNCTION "sales-pipe".record_whatsapp_status(p_statuses jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v_count int := 0;
    v_n int;
BEGIN
    WITH s AS (
        SELECT DISTINCT ON (r.id, r.status)
            r.id, r.status, coalesce(to_timestamp(nullif(r."timestamp", '')::bigint), now()) AS at, left(r.error, 500) AS error,
            CASE r.status WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END AS rank
        FROM jsonb_to_recordset(p_statuses) AS r(id text, status text, "timestamp" text, error text)
        WHERE r.id IS NOT NULL AND r.status IN ('sent', 'delivered', 'read', 'failed')
    ), best AS (
        SELECT DISTINCT ON (id) * FROM s ORDER BY id, rank DESC, at DESC
    )
    UPDATE "sales-pipe".messages m
    SET delivery_status = CASE
            WHEN b.status = 'failed' THEN CASE WHEN m.delivery_status IN ('delivered', 'read') THEN m.delivery_status ELSE 'failed' END
            WHEN b.rank > CASE m.delivery_status WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END THEN b.status
            ELSE m.delivery_status END,
        delivered_at = CASE WHEN b.status IN ('delivered', 'read') THEN coalesce(m.delivered_at, b.at) ELSE m.delivered_at END,
        read_at = CASE WHEN b.status = 'read' THEN coalesce(m.read_at, b.at) ELSE m.read_at END,
        error_detail = CASE WHEN b.status = 'failed' AND coalesce(m.delivery_status, '') NOT IN ('delivered', 'read') THEN coalesce(b.error, 'Not delivered') ELSE m.error_detail END
    FROM best b
    WHERE m.external_message_id = b.id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_count := v_count + v_n;

    WITH s AS (
        SELECT DISTINCT ON (r.id, r.status)
            r.id, r.status, coalesce(to_timestamp(nullif(r."timestamp", '')::bigint), now()) AS at, left(r.error, 500) AS error,
            CASE r.status WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END AS rank
        FROM jsonb_to_recordset(p_statuses) AS r(id text, status text, "timestamp" text, error text)
        WHERE r.id IS NOT NULL AND r.status IN ('sent', 'delivered', 'read', 'failed')
    ), best AS (
        SELECT DISTINCT ON (id) * FROM s ORDER BY id, rank DESC, at DESC
    )
    UPDATE "sales-pipe".campaign_recipients cr
    SET delivery_status = CASE
            WHEN b.status = 'failed' THEN CASE WHEN cr.delivery_status IN ('delivered', 'read') THEN cr.delivery_status ELSE 'failed' END
            WHEN b.rank > CASE cr.delivery_status WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END THEN b.status
            ELSE cr.delivery_status END,
        delivered_at = CASE WHEN b.status IN ('delivered', 'read') THEN coalesce(cr.delivered_at, b.at) ELSE cr.delivered_at END,
        read_at = CASE WHEN b.status = 'read' THEN coalesce(cr.read_at, b.at) ELSE cr.read_at END,
        status = CASE WHEN b.status = 'failed' AND coalesce(cr.delivery_status, '') NOT IN ('delivered', 'read') THEN 'failed' ELSE cr.status END,
        error_detail = CASE WHEN b.status = 'failed' AND coalesce(cr.delivery_status, '') NOT IN ('delivered', 'read') THEN coalesce(b.error, 'Not delivered') ELSE cr.error_detail END,
        updated_at = now()
    FROM best b
    WHERE cr.external_message_id = b.id AND cr.channel = 'whatsapp';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_count := v_count + v_n;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION "sales-pipe".record_whatsapp_status(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe".record_whatsapp_status(jsonb) TO service_role;

-- 49. record_email_events: called by webhook for Resend delivery/open/click/bounce tracking (service role only)
CREATE OR REPLACE FUNCTION "sales-pipe".record_email_events(p_events jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    e record;
    v_at timestamptz;
    v_count int := 0;
    v_n int;
    v_final text;   -- bounced / complained / failed, or NULL
    v_reason text;
BEGIN
    FOR e IN
        SELECT * FROM jsonb_to_recordset(p_events)
            AS r(id text, type text, "at" text, "to" text, reason text, permanent boolean)
        WHERE r.id IS NOT NULL
    LOOP
        v_at := coalesce(nullif(e."at", '')::timestamptz, now());
        v_final := CASE e.type WHEN 'bounced' THEN 'bounced' WHEN 'complained' THEN 'complained' WHEN 'failed' THEN 'failed' END;
        v_reason := CASE e.type
            WHEN 'bounced' THEN 'Bounced' || coalesce(': ' || nullif(e.reason, ''), '')
            WHEN 'complained' THEN 'Marked as spam by the recipient'
            WHEN 'failed' THEN 'Not sent' || coalesce(': ' || nullif(e.reason, ''), '')
        END;

        IF e.type NOT IN ('delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed') THEN
            CONTINUE;  -- sent / delivery_delayed change nothing we show
        END IF;

        UPDATE "sales-pipe".messages m
        SET delivery_status = CASE
                WHEN m.delivery_status IN ('bounced', 'complained') THEN m.delivery_status
                WHEN v_final IS NOT NULL THEN v_final
                WHEN coalesce(m.delivery_status, 'sent') IN ('queued', 'sent') THEN 'delivered'
                ELSE m.delivery_status END,
            delivered_at = CASE WHEN v_final IS NULL THEN coalesce(m.delivered_at, v_at) ELSE m.delivered_at END,
            opened_at = CASE WHEN e.type IN ('opened', 'clicked') THEN coalesce(m.opened_at, v_at) ELSE m.opened_at END,
            clicked_at = CASE WHEN e.type = 'clicked' THEN coalesce(m.clicked_at, v_at) ELSE m.clicked_at END,
            error_detail = CASE WHEN v_final IS NOT NULL AND coalesce(m.delivery_status, '') NOT IN ('bounced', 'complained') THEN left(v_reason, 500) ELSE m.error_detail END
        WHERE m.external_message_id = e.id;
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_count := v_count + v_n;

        UPDATE "sales-pipe".campaign_recipients cr
        SET delivery_status = CASE
                WHEN cr.delivery_status IN ('bounced', 'complained') THEN cr.delivery_status
                WHEN v_final IS NOT NULL THEN v_final
                WHEN cr.delivery_status IS NULL OR cr.delivery_status = 'sent' THEN 'delivered'
                ELSE cr.delivery_status END,
            delivered_at = CASE WHEN v_final IS NULL THEN coalesce(cr.delivered_at, v_at) ELSE cr.delivered_at END,
            opened_at = CASE WHEN e.type IN ('opened', 'clicked') THEN coalesce(cr.opened_at, v_at) ELSE cr.opened_at END,
            clicked_at = CASE WHEN e.type = 'clicked' THEN coalesce(cr.clicked_at, v_at) ELSE cr.clicked_at END,
            -- The provider accepted it but it never arrived: show it as failed in the report
            status = CASE WHEN v_final IS NOT NULL THEN 'failed' ELSE cr.status END,
            error_detail = CASE WHEN v_final IS NOT NULL AND coalesce(cr.delivery_status, '') NOT IN ('bounced', 'complained') THEN left(v_reason, 500) ELSE cr.error_detail END,
            updated_at = now()
        WHERE cr.external_message_id = e.id AND cr.channel = 'email';
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_count := v_count + v_n;

        -- Never email an address that hard-bounced or reported us as spam again
        IF (e.type = 'bounced' AND coalesce(e.permanent, true)) OR e.type = 'complained' THEN
            INSERT INTO "sales-pipe".opt_outs (identifier, channel, reason, source)
            SELECT lower(trim(addr)), 'Email', left(v_reason, 300), CASE WHEN e.type = 'complained' THEN 'complaint' ELSE 'bounce' END
            FROM (
                SELECT coalesce(nullif(e."to", ''),
                    (SELECT cr.email FROM "sales-pipe".campaign_recipients cr WHERE cr.external_message_id = e.id LIMIT 1),
                    (SELECT b.email FROM "sales-pipe".messages m
                        JOIN "sales-pipe".threads t ON t.id = m.thread_id
                        JOIN "sales-pipe".opportunities o ON o.id = t.opportunity_id
                        JOIN "sales-pipe".businesses b ON b.id = o.business_id
                     WHERE m.external_message_id = e.id LIMIT 1)) AS addr
            ) a
            WHERE addr IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM "sales-pipe".opt_outs o
                              WHERE lower(o.identifier) = lower(trim(a.addr)) AND lower(o.channel) IN ('all', 'email'));
        END IF;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION "sales-pipe".record_email_events(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe".record_email_events(jsonb) TO service_role;

-- 50. record_unsubscribe: called by /unsubscribe after checking signature (service role only)
CREATE OR REPLACE FUNCTION "sales-pipe".record_unsubscribe(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v_email text := lower(trim(p_email));
    v_id uuid;
    v_name text;
BEGIN
    IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+$' THEN
        RAISE EXCEPTION 'Not an email address';
    END IF;

    IF EXISTS (SELECT 1 FROM "sales-pipe".opt_outs
               WHERE lower(identifier) = v_email AND lower(channel) IN ('all', 'email')) THEN
        RETURN jsonb_build_object('already', true);
    END IF;

    INSERT INTO "sales-pipe".opt_outs (identifier, channel, reason, source)
    VALUES (v_email, 'Email', 'Unsubscribed using the link in our email', 'unsubscribe')
    RETURNING id INTO v_id;

    SELECT string_agg(DISTINCT b.business_name, ', ') INTO v_name
    FROM "sales-pipe".businesses b WHERE lower(b.email) = v_email;

    -- Tell the admins and whoever owns the lead
    INSERT INTO "sales-pipe".notifications (user_id, type, title, message, link)
    SELECT DISTINCT ON (u.user_id) u.user_id, 'unsubscribed',
           coalesce(v_name, v_email) || ' unsubscribed from emails',
           coalesce(v_name, v_email) || ' unsubscribed from emails',
           coalesce(u.link, '/dashboard/settings#do-not-contact')
    FROM (
        SELECT p.id AS user_id, NULL::text AS link
        FROM "sales-pipe".profiles p WHERE p.role = 'admin' AND p.is_active
        UNION ALL
        SELECT x.user_id, '/dashboard/' || o.id
        FROM "sales-pipe".opportunities o
        JOIN "sales-pipe".businesses b ON b.id = o.business_id
        CROSS JOIN LATERAL (VALUES (o.assigned_sales_id), (o.assigned_consultant_id)) x(user_id)
        WHERE lower(b.email) = v_email AND x.user_id IS NOT NULL
    ) u
    ORDER BY u.user_id, u.link NULLS LAST;

    INSERT INTO "sales-pipe".user_logs (user_name, action, entity_type, entity_id, details)
    VALUES ('Lead', 'unsubscribed', 'opt_out', v_id::text,
            jsonb_build_object('email', v_email, 'business', v_name));

    RETURN jsonb_build_object('already', false);
END;
$$;

REVOKE ALL ON FUNCTION "sales-pipe".record_unsubscribe(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe".record_unsubscribe(text) TO service_role;

-- 51. remove_opt_out: admins undo an email block from Settings
CREATE OR REPLACE FUNCTION "sales-pipe".remove_opt_out(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v_row "sales-pipe".opt_outs;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin']);

    DELETE FROM "sales-pipe".opt_outs WHERE id = p_id RETURNING * INTO v_row;
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'This entry was already removed'; END IF;

    INSERT INTO "sales-pipe".user_logs (user_id, user_name, action, entity_type, entity_id, details)
    SELECT auth.uid()::text, p.full_name, 'removed_opt_out', 'opt_out', v_row.id::text,
           jsonb_build_object('identifier', v_row.identifier, 'channel', v_row.channel,
                              'source', v_row.source, 'reason', v_row.reason, 'blocked_at', v_row.created_at)
    FROM (SELECT 1) one
    LEFT JOIN "sales-pipe".profiles p ON p.id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION "sales-pipe".remove_opt_out(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "sales-pipe".remove_opt_out(uuid) TO authenticated, service_role;

-- 52. sync_profile_from_matrix: syncs access from public.user_product_access & hr.employees
CREATE OR REPLACE FUNCTION "sales-pipe".sync_profile_from_matrix(p_employee_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_emp  record;
  v_role text;
BEGIN
  SELECT e.auth_user_id, e.full_name, e.status INTO v_emp
  FROM hr.employees e WHERE e.id = p_employee_id;
  IF NOT FOUND OR v_emp.auth_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT CASE pr.code WHEN 'admin' THEN 'admin' WHEN 'consultant' THEN 'consultant' ELSE 'sales' END
  INTO v_role
  FROM public.user_product_access upa
  JOIN public.products p      ON p.product_id = upa.product_id AND p.code = 'sales_pipeline'
  JOIN public.product_roles pr ON pr.id = upa.product_role_id
  WHERE upa.employee_id = p_employee_id;

  -- Same rule as the Admin Panel's sign-in: only terminated employees are blocked
  IF v_role IS NOT NULL AND v_emp.status <> 'terminated' THEN
    INSERT INTO "sales-pipe".profiles (id, full_name, role, is_active)
    VALUES (v_emp.auth_user_id, v_emp.full_name, v_role, true)
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = true;
  ELSE
    UPDATE "sales-pipe".profiles SET is_active = false WHERE id = v_emp.auth_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION "sales-pipe".sync_profile_from_matrix(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe".sync_profile_from_matrix(integer) TO service_role;

-- 53. on_matrix_change: trigger on public.user_product_access
CREATE OR REPLACE FUNCTION "sales-pipe".on_matrix_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM "sales-pipe".sync_profile_from_matrix(OLD.employee_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM "sales-pipe".sync_profile_from_matrix(NEW.employee_id);
  END IF;
  RETURN NULL;
END;
$$;

-- 54. on_employee_change: trigger on hr.employees
CREATE OR REPLACE FUNCTION "sales-pipe".on_employee_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.auth_user_id IS NOT NULL AND OLD.auth_user_id IS DISTINCT FROM NEW.auth_user_id THEN
    UPDATE "sales-pipe".profiles SET is_active = false WHERE id = OLD.auth_user_id;
  END IF;
  PERFORM "sales-pipe".sync_profile_from_matrix(NEW.id);
  RETURN NULL;
END;
$$;

-- 55. set_member_capacity: admin updates active lead capacity
CREATE OR REPLACE FUNCTION "sales-pipe".set_member_capacity(p_id uuid, p_capacity integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $$
BEGIN
  PERFORM "sales-pipe".require_role(ARRAY['admin']);
  IF p_capacity IS NOT NULL AND (p_capacity < 1 OR p_capacity > 1000) THEN
    RAISE EXCEPTION 'Active leads must be between 1 and 1000';
  END IF;
  UPDATE "sales-pipe".profiles SET capacity = p_capacity WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Person not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION "sales-pipe".set_member_capacity(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "sales-pipe".set_member_capacity(uuid, integer) TO authenticated, service_role;

-- 56. update_member: guard for legacy profile edits
CREATE OR REPLACE FUNCTION "sales-pipe".update_member(p_id uuid, p_full_name text, p_role text, p_capacity integer, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Roles and access are managed in the Admin Panel (Access page)';
END;
$$;




-- ==============================================================================
-- BOOTSTRAP SEED DATA
-- ==============================================================================

INSERT INTO "sales-pipe".business_categories (name, slug, icon_name, description, category_group, synonyms, sort_order) VALUES
('Hotel', 'hotel', 'Building2', 'Hotels, boutique hotels, B&Bs, and guest accommodation', 'Accommodation', ARRAY['hotel', 'hotels', 'boutique hotel', 'b&b', 'b b', 'bnb', 'b&b / guesthouse', 'guesthouse', 'guest house', 'inn', 'pub with rooms', 'barge b b', 'hostel', 'resort', 'motel', 'lodging', 'accommodation'], 1),
('Restaurant or cafe', 'restaurant-or-cafe', 'UtensilsCrossed', 'Restaurants, cafes, bistros, bakeries, and dining venues', 'Food & Drink', ARRAY['restaurant or cafe', 'restaurants and cafes', 'restaurants & cafes', 'restaurant', 'restaurants', 'cafe', 'cafes', 'coffee shop', 'coffee', 'park cafe', 'cafe bar', 'tea room', 'bistro', 'bakery', 'takeaway', 'diner', 'eatery', 'food & drink', 'food'], 2),
('Pub', 'pub', 'Beer', 'Pubs, bars, taverns, and social taprooms', 'Food & Drink', ARRAY['pub', 'pubs', 'bar', 'bars', 'pub bar', 'pub / bar', 'public house', 'tavern', 'gastropub'], 3),
('Property management', 'property-management', 'Home', 'Property management companies, short-let and Airbnb operators', 'Accommodation', ARRAY['property management', 'property manager', 'property', 'properties', 'airbnb', 'airbnb host', 'short let', 'short-let', 'short-let / airbnb host', 'serviced apartments', 'serviced apartment', 'apartment', 'apartments', 'co living', 'aparthotel', 'estate agent', 'letting agent', 'real estate'], 4)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, icon_name = EXCLUDED.icon_name, description = EXCLUDED.description,
    category_group = EXCLUDED.category_group, synonyms = EXCLUDED.synonyms, sort_order = EXCLUDED.sort_order;

INSERT INTO "sales-pipe".services (name, code, description, sort_order) VALUES
('Website', 'website', 'High-converting custom website design and booking engine integration', 1),
('Micro Automation', 'micro-automation', 'Targeted automated workflows, lead capture, and notifications', 2),
('End-to-End Automation', 'e2e-automation', 'Full-cycle operational and CRM automation suites', 3),
('Custom Dashboard', 'custom-dashboard', 'Real-time performance analytics and operational reporting portals', 4),
('Cold Outreach', 'cold-outreach', 'Multi-channel outbound lead generation and campaign management', 5)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, sort_order = EXCLUDED.sort_order;

INSERT INTO "sales-pipe".outreach_platforms (name, slug, is_direct_send, daily_limit, sort_order) VALUES
('Email', 'email', true, 200, 1),
('WhatsApp', 'whatsapp', true, 100, 2),
('Instagram', 'instagram', false, 50, 3),
('Facebook', 'facebook', false, 50, 4),
('LinkedIn', 'linkedin', false, 50, 5),
('Phone', 'phone', false, 100, 6),
('Walk-in', 'walk-in', false, 100, 7)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, is_direct_send = EXCLUDED.is_direct_send, daily_limit = EXCLUDED.daily_limit, sort_order = EXCLUDED.sort_order;

INSERT INTO "sales-pipe".cadence_rules (step_name, days_delay, description) VALUES
('Initial Outreach', 0, 'Triggered immediately when opportunity enters outreach queue'),
('Follow-up 1', 3, 'Follow-up step triggered after 3 days without response'),
('Follow-up 2', 5, 'Final follow-up attempt triggered after 5 days without response'),
('Audit Delivered', 2, 'Delivering requested digital gap audit report')
ON CONFLICT (step_name) DO UPDATE SET
    days_delay = EXCLUDED.days_delay, description = EXCLUDED.description;

INSERT INTO "sales-pipe".pipeline_settings (key, value, description) VALUES
('auto_assign_leads', 'true'::jsonb, 'Automatically round-robin new approved leads to active sales reps'),
('lead_capacity_limit', '50'::jsonb, 'Default maximum active leads per sales rep'),
('company_name', '"Selfera Sales"'::jsonb, 'Brand name used across outreach signatures'),
('default_business_category', '"Restaurant or cafe"'::jsonb, 'Category used when a lead''s business type matches no category')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value, description = EXCLUDED.description;
