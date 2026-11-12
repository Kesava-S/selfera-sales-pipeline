-- ==============================================================================
-- 31_user_logs.sql
-- Table: "sales-pipe".user_logs
-- User activity, actions, and audit trail
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".user_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text,
    user_name text,
    action text NOT NULL,
    entity_type text,
    entity_id text,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_logs_action ON "sales-pipe".user_logs(action);
CREATE INDEX IF NOT EXISTS idx_user_logs_created_at ON "sales-pipe".user_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_logs_user_id ON "sales-pipe".user_logs(user_id);

-- Enable RLS
ALTER TABLE "sales-pipe".user_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_logs_admin" ON "sales-pipe".user_logs;
CREATE POLICY "user_logs_admin" ON "sales-pipe".user_logs
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() = 'admin')
    WITH CHECK ("sales-pipe".get_user_role() = 'admin');

GRANT ALL ON "sales-pipe".user_logs TO service_role;
GRANT SELECT ON "sales-pipe".user_logs TO authenticated;

