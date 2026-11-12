-- ==============================================================================
-- 30_error_logs.sql
-- Table: "sales-pipe".error_logs
-- Application runtime error and exception tracking
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".error_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    error_message text NOT NULL,
    error_stack text,
    context text,
    user_id text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_context ON "sales-pipe".error_logs(context);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON "sales-pipe".error_logs(created_at DESC);

-- Enable RLS
ALTER TABLE "sales-pipe".error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "error_logs_admin" ON "sales-pipe".error_logs;
CREATE POLICY "error_logs_admin" ON "sales-pipe".error_logs
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() = 'admin')
    WITH CHECK ("sales-pipe".get_user_role() = 'admin');

GRANT ALL ON "sales-pipe".error_logs TO service_role;
GRANT SELECT ON "sales-pipe".error_logs TO authenticated;

