-- ==============================================================================
-- 26_whatsapp_campaigns.sql
-- Table: "sales-pipe".whatsapp_campaigns
-- WhatsApp broadcast campaigns, message payloads, and delivery logs
-- ==============================================================================

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_status ON "sales-pipe".whatsapp_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_database ON "sales-pipe".whatsapp_campaigns(database_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_created ON "sales-pipe".whatsapp_campaigns(created_at DESC);

-- Enable RLS
ALTER TABLE "sales-pipe".whatsapp_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_campaigns_access" ON "sales-pipe".whatsapp_campaigns;
CREATE POLICY "whatsapp_campaigns_access" ON "sales-pipe".whatsapp_campaigns
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IS NOT NULL)
    WITH CHECK ("sales-pipe".get_user_role() IS NOT NULL);

REVOKE ALL ON "sales-pipe".whatsapp_campaigns FROM anon;
GRANT ALL ON "sales-pipe".whatsapp_campaigns TO authenticated, service_role;
