-- ==============================================================================
-- 06_app_logs.sql
-- Table: "sales-pipe".app_logs
-- Tracks application lifecycle, background jobs, system events, and health metrics
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".app_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event text NOT NULL,
    category text NOT NULL DEFAULT 'system',
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- Indexes for performance and quick searching
CREATE INDEX IF NOT EXISTS idx_app_logs_event ON "sales-pipe".app_logs(event);
CREATE INDEX IF NOT EXISTS idx_app_logs_category ON "sales-pipe".app_logs(category);
CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON "sales-pipe".app_logs(created_at DESC);

-- Enable RLS
ALTER TABLE "sales-pipe".app_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Full access for anon & authenticated
DROP POLICY IF EXISTS "app_logs_full_access" ON "sales-pipe".app_logs;
CREATE POLICY "app_logs_full_access" ON "sales-pipe".app_logs
    FOR ALL USING (true) WITH CHECK (true);
