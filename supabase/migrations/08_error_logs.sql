-- ==============================================================================
-- 08_error_logs.sql
-- Table: "sales-pipe".error_logs
-- Captures runtime client & server errors, failed operations, and debug traces
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".error_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    error_message text NOT NULL,
    error_stack text,
    context text,
    user_id text DEFAULT 'sales-1',
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_error_logs_context ON "sales-pipe".error_logs(context);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON "sales-pipe".error_logs(created_at DESC);

-- Enable RLS
ALTER TABLE "sales-pipe".error_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Full access for anon & authenticated
DROP POLICY IF EXISTS "error_logs_full_access" ON "sales-pipe".error_logs;
CREATE POLICY "error_logs_full_access" ON "sales-pipe".error_logs
    FOR ALL USING (true) WITH CHECK (true);
