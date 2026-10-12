-- ==============================================================================
-- 28_v2_email_campaigns.sql
-- Table: "sales-pipe".email_campaigns
-- Simple & minimalistic email campaign creation & management
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".email_campaigns (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    subject text NOT NULL,
    preheader text,
    body text NOT NULL,
    service text DEFAULT 'General',
    target_category text DEFAULT 'All',
    target_stage text DEFAULT 'All',
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'archived')),
    recipient_count integer DEFAULT 0,
    recipients jsonb DEFAULT '[]'::jsonb,
    sent_at timestamp with time zone,
    scheduled_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE "sales-pipe".email_campaigns ENABLE ROW LEVEL SECURITY;

-- Full access for authenticated users & anon
DROP POLICY IF EXISTS "email_campaigns_access" ON "sales-pipe".email_campaigns;
CREATE POLICY "email_campaigns_access" ON "sales-pipe".email_campaigns
    FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON "sales-pipe".email_campaigns TO authenticated, anon, service_role;
