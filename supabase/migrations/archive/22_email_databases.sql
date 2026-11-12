-- ==============================================================================
-- 22_email_databases.sql
-- Table: "sales-pipe".email_databases
-- Custom recipient databases for targeted bulk email broadcasts
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".email_databases (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    contacts jsonb DEFAULT '[]'::jsonb,
    contact_count integer DEFAULT 0,
    created_by uuid REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_databases_created_by ON "sales-pipe".email_databases(created_by);
CREATE INDEX IF NOT EXISTS idx_email_databases_created_at ON "sales-pipe".email_databases(created_at DESC);

-- Enable RLS
ALTER TABLE "sales-pipe".email_databases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_databases_access" ON "sales-pipe".email_databases;
CREATE POLICY "email_databases_access" ON "sales-pipe".email_databases
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales'))
    WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales'));

GRANT ALL ON "sales-pipe".email_databases TO authenticated, anon, service_role;
