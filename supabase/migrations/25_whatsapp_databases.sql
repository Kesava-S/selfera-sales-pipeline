-- ==============================================================================
-- 25_whatsapp_databases.sql
-- Table: "sales-pipe".whatsapp_databases
-- Target contact lists and phone databases for WhatsApp campaigns
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".whatsapp_databases (
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
CREATE INDEX IF NOT EXISTS idx_whatsapp_databases_created_by ON "sales-pipe".whatsapp_databases(created_by);
CREATE INDEX IF NOT EXISTS idx_whatsapp_databases_created_at ON "sales-pipe".whatsapp_databases(created_at DESC);

-- Enable RLS
ALTER TABLE "sales-pipe".whatsapp_databases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_databases_access" ON "sales-pipe".whatsapp_databases;
CREATE POLICY "whatsapp_databases_access" ON "sales-pipe".whatsapp_databases
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales'))
    WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales'));

GRANT ALL ON "sales-pipe".whatsapp_databases TO authenticated, anon, service_role;
