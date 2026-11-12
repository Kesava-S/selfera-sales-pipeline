-- ==============================================================================
-- 24_campaign_recipients.sql
-- Table: "sales-pipe".campaign_recipients
-- Granular per-contact campaign delivery tracking, send queue, and failure retries
-- ==============================================================================

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

-- Unique constraints per recipient per campaign
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_recipients_email
    ON "sales-pipe".campaign_recipients (campaign_id, lower(email)) WHERE channel = 'email';
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_recipients_phone
    ON "sales-pipe".campaign_recipients (whatsapp_campaign_id, regexp_replace(phone, '\D', '', 'g')) WHERE channel = 'whatsapp';

-- Queue and lookup indexes
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_due
    ON "sales-pipe".campaign_recipients (next_attempt_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_wa_cid
    ON "sales-pipe".campaign_recipients (whatsapp_campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_cid
    ON "sales-pipe".campaign_recipients (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_business
    ON "sales-pipe".campaign_recipients (business_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status
    ON "sales-pipe".campaign_recipients (status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_external
    ON "sales-pipe".campaign_recipients (external_message_id) WHERE external_message_id IS NOT NULL;

-- Enable RLS
ALTER TABLE "sales-pipe".campaign_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaign_recipients_select" ON "sales-pipe".campaign_recipients;
CREATE POLICY "campaign_recipients_select" ON "sales-pipe".campaign_recipients
    FOR SELECT TO authenticated
    USING ("sales-pipe".get_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "campaign_recipients_manage" ON "sales-pipe".campaign_recipients;
CREATE POLICY "campaign_recipients_manage" ON "sales-pipe".campaign_recipients
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IS NOT NULL)
    WITH CHECK ("sales-pipe".get_user_role() IS NOT NULL);

REVOKE ALL ON "sales-pipe".campaign_recipients FROM anon;
GRANT ALL ON "sales-pipe".campaign_recipients TO authenticated, service_role;
