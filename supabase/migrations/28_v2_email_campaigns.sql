-- ==============================================================================
-- 28_v2_email_campaigns.sql
-- Table: "sales-pipe".email_databases
-- Table: "sales-pipe".email_campaigns
-- Simple & minimalistic target databases & email campaign management
-- ==============================================================================

-- 1. Target Databases Table
CREATE TABLE IF NOT EXISTS "sales-pipe".email_databases (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    contacts jsonb DEFAULT '[]'::jsonb,
    contact_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE "sales-pipe".email_databases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_databases_access" ON "sales-pipe".email_databases;
CREATE POLICY "email_databases_access" ON "sales-pipe".email_databases
    FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON "sales-pipe".email_databases TO authenticated, anon, service_role;

-- 2. Email Campaigns Table
CREATE TABLE IF NOT EXISTS "sales-pipe".email_campaigns (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    subject text NOT NULL,
    preheader text,
    body text NOT NULL,
    service text DEFAULT 'General',
    database_id uuid REFERENCES "sales-pipe".email_databases(id) ON DELETE SET NULL,
    database_name text,
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'archived')),
    recipient_count integer DEFAULT 0,
    recipients jsonb DEFAULT '[]'::jsonb,
    sent_at timestamp with time zone,
    scheduled_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE "sales-pipe".email_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_campaigns_access" ON "sales-pipe".email_campaigns;
CREATE POLICY "email_campaigns_access" ON "sales-pipe".email_campaigns
    FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON "sales-pipe".email_campaigns TO authenticated, anon, service_role;
