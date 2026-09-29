-- ==============================================================================
-- 07_user_logs.sql
-- Table: "sales-pipe".user_logs
-- Tracks salesperson activity, lead updates, stage transitions, and audit trails
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".user_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id text DEFAULT 'sales-1',
    user_name text DEFAULT 'Kesav S.',
    action text NOT NULL,
    entity_type text,
    entity_id text,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_logs_action ON "sales-pipe".user_logs(action);
CREATE INDEX IF NOT EXISTS idx_user_logs_entity ON "sales-pipe".user_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_user_logs_created_at ON "sales-pipe".user_logs(created_at DESC);

-- Enable RLS
ALTER TABLE "sales-pipe".user_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Full access for anon & authenticated
DROP POLICY IF EXISTS "user_logs_full_access" ON "sales-pipe".user_logs;
CREATE POLICY "user_logs_full_access" ON "sales-pipe".user_logs
    FOR ALL USING (true) WITH CHECK (true);
