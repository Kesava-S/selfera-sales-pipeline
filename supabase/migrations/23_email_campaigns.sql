-- ==============================================================================
-- 23_email_campaigns.sql
-- Table: "sales-pipe".email_campaigns
-- Bulk email campaigns, schedules, and recipient delivery snapshots
-- ==============================================================================

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON "sales-pipe".email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_database ON "sales-pipe".email_campaigns(database_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_created ON "sales-pipe".email_campaigns(created_at DESC);

-- Enable RLS
ALTER TABLE "sales-pipe".email_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_campaigns_access" ON "sales-pipe".email_campaigns;
CREATE POLICY "email_campaigns_access" ON "sales-pipe".email_campaigns
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IS NOT NULL)
    WITH CHECK ("sales-pipe".get_user_role() IS NOT NULL);

REVOKE ALL ON "sales-pipe".email_campaigns FROM anon;
GRANT ALL ON "sales-pipe".email_campaigns TO authenticated, service_role;
