-- ==============================================================================
-- 21_webhook_events.sql
-- Table: "sales-pipe".webhook_events
-- Inbound webhook idempotency queue and processing logs
-- ==============================================================================

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON "sales-pipe".webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_source ON "sales-pipe".webhook_events(source);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON "sales-pipe".webhook_events(created_at DESC);

-- Enable RLS
ALTER TABLE "sales-pipe".webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_events_admin" ON "sales-pipe".webhook_events;
CREATE POLICY "webhook_events_admin" ON "sales-pipe".webhook_events
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() = 'admin')
    WITH CHECK ("sales-pipe".get_user_role() = 'admin');

GRANT ALL ON "sales-pipe".webhook_events TO service_role;
