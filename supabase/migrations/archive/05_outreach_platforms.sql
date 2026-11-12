-- ==============================================================================
-- 05_outreach_platforms.sql
-- Table: "sales-pipe".outreach_platforms
-- Supported communication channels (Email, WhatsApp, Phone, etc.) and limits
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".outreach_platforms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    slug text NOT NULL UNIQUE,
    is_direct_send boolean DEFAULT false,
    daily_limit int DEFAULT 100,
    is_active boolean DEFAULT true,
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_platforms_slug ON "sales-pipe".outreach_platforms(slug);
CREATE INDEX IF NOT EXISTS idx_outreach_platforms_active ON "sales-pipe".outreach_platforms(is_active);

-- Enable RLS
ALTER TABLE "sales-pipe".outreach_platforms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outreach_platforms_read" ON "sales-pipe".outreach_platforms;
CREATE POLICY "outreach_platforms_read" ON "sales-pipe".outreach_platforms
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "outreach_platforms_admin_manage" ON "sales-pipe".outreach_platforms;
CREATE POLICY "outreach_platforms_admin_manage" ON "sales-pipe".outreach_platforms
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() = 'admin')
    WITH CHECK ("sales-pipe".get_user_role() = 'admin');
