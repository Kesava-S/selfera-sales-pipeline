-- ==============================================================================
-- 34_campaign_replies.sql
-- Table: "sales-pipe".campaign_replies
-- Inbound reply tracking for email and WhatsApp campaigns
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".campaign_replies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
    from_address text NOT NULL,
    subject text,
    body text NOT NULL,
    external_message_id text UNIQUE,
    received_at timestamptz NOT NULL DEFAULT now(),
    recipient_id uuid REFERENCES "sales-pipe".campaign_recipients(id) ON DELETE SET NULL,
    campaign_id uuid REFERENCES "sales-pipe".email_campaigns(id) ON DELETE SET NULL,
    whatsapp_campaign_id uuid REFERENCES "sales-pipe".whatsapp_campaigns(id) ON DELETE SET NULL,
    business_id uuid REFERENCES "sales-pipe".businesses(id) ON DELETE SET NULL,
    opportunity_id uuid REFERENCES "sales-pipe".opportunities(id) ON DELETE SET NULL,
    thread_id uuid REFERENCES "sales-pipe".threads(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_leads', 'dismissed')),
    handled_by uuid REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL,
    handled_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_campaign_replies_campaign ON "sales-pipe".campaign_replies (campaign_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_wa_campaign ON "sales-pipe".campaign_replies (whatsapp_campaign_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_status ON "sales-pipe".campaign_replies (status, received_at DESC);

-- Enable RLS
ALTER TABLE "sales-pipe".campaign_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaign_replies_read ON "sales-pipe".campaign_replies;
CREATE POLICY campaign_replies_read ON "sales-pipe".campaign_replies
    FOR SELECT TO authenticated 
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales'));

REVOKE ALL ON "sales-pipe".campaign_replies FROM PUBLIC, anon;
GRANT SELECT ON "sales-pipe".campaign_replies TO authenticated;
GRANT ALL ON "sales-pipe".campaign_replies TO service_role;

