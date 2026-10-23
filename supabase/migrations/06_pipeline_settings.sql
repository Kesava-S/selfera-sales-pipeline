-- ==============================================================================
-- 06_pipeline_settings.sql
-- Table: "sales-pipe".pipeline_settings
-- Global key-value configuration, defaults, and capacity metrics
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".pipeline_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL UNIQUE,
    value jsonb NOT NULL,
    description text,
    updated_by uuid REFERENCES "sales-pipe".profiles(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_settings_key ON "sales-pipe".pipeline_settings(key);

-- Enable RLS
ALTER TABLE "sales-pipe".pipeline_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pipeline_settings_read" ON "sales-pipe".pipeline_settings;
CREATE POLICY "pipeline_settings_read" ON "sales-pipe".pipeline_settings
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "pipeline_settings_admin_manage" ON "sales-pipe".pipeline_settings;
CREATE POLICY "pipeline_settings_admin_manage" ON "sales-pipe".pipeline_settings
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() = 'admin')
    WITH CHECK ("sales-pipe".get_user_role() = 'admin');
