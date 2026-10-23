-- ==============================================================================
-- 18_cadence_rules.sql
-- Table: "sales-pipe".cadence_rules
-- Defines delay intervals in days between outreach steps
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".cadence_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    step_name text NOT NULL UNIQUE,
    days_delay int NOT NULL DEFAULT 3,
    description text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cadence_rules_step ON "sales-pipe".cadence_rules(step_name);

-- Enable RLS
ALTER TABLE "sales-pipe".cadence_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cadence_rules_read" ON "sales-pipe".cadence_rules;
CREATE POLICY "cadence_rules_read" ON "sales-pipe".cadence_rules
    FOR SELECT TO authenticated
    USING ("sales-pipe".get_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "cadence_rules_admin_manage" ON "sales-pipe".cadence_rules;
CREATE POLICY "cadence_rules_admin_manage" ON "sales-pipe".cadence_rules
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() = 'admin')
    WITH CHECK ("sales-pipe".get_user_role() = 'admin');
