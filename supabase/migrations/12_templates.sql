-- ==============================================================================
-- 12_templates.sql
-- Table: "sales-pipe".templates
-- Outreach message templates parameterized by platform, step, and service
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    platform text NOT NULL,
    step text NOT NULL,
    business_types text[] DEFAULT '{}'::text[],
    services text[] DEFAULT '{}'::text[],
    subject text,
    body text NOT NULL,
    whatsapp_template_name text,
    is_active boolean DEFAULT true,
    created_by uuid REFERENCES "sales-pipe".profiles(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_templates_platform ON "sales-pipe".templates(platform);
CREATE INDEX IF NOT EXISTS idx_templates_step ON "sales-pipe".templates(step);
CREATE INDEX IF NOT EXISTS idx_templates_active ON "sales-pipe".templates(is_active);

-- Enable RLS
ALTER TABLE "sales-pipe".templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "templates_select" ON "sales-pipe".templates;
CREATE POLICY "templates_select" ON "sales-pipe".templates
    FOR SELECT TO authenticated
    USING ("sales-pipe".get_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "templates_manage" ON "sales-pipe".templates;
CREATE POLICY "templates_manage" ON "sales-pipe".templates
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales'))
    WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales'));
