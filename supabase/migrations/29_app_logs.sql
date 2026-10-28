-- ==============================================================================
-- 29_app_logs.sql
-- Table: "sales-pipe".app_logs
-- System events and general application audit logging
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".app_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event text NOT NULL,
    category text NOT NULL DEFAULT 'system',
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_logs_event ON "sales-pipe".app_logs(event);
CREATE INDEX IF NOT EXISTS idx_app_logs_category ON "sales-pipe".app_logs(category);
CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON "sales-pipe".app_logs(created_at DESC);

-- Enable RLS
ALTER TABLE "sales-pipe".app_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_logs_admin" ON "sales-pipe".app_logs;
CREATE POLICY "app_logs_admin" ON "sales-pipe".app_logs
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() = 'admin')
    WITH CHECK ("sales-pipe".get_user_role() = 'admin');

GRANT ALL ON "sales-pipe".app_logs TO service_role;
GRANT SELECT ON "sales-pipe".app_logs TO authenticated;

