-- ==============================================================================
-- 04_services.sql
-- Table: "sales-pipe".services
-- Catalog of dynamic services offered and pitched across the pipeline
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    code text NOT NULL UNIQUE,
    description text,
    price_range text,
    is_active boolean DEFAULT true,
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_code ON "sales-pipe".services(code);
CREATE INDEX IF NOT EXISTS idx_services_active ON "sales-pipe".services(is_active);

-- Enable RLS
ALTER TABLE "sales-pipe".services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "services_read" ON "sales-pipe".services;
CREATE POLICY "services_read" ON "sales-pipe".services
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "services_admin_manage" ON "sales-pipe".services;
CREATE POLICY "services_admin_manage" ON "sales-pipe".services
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() = 'admin')
    WITH CHECK ("sales-pipe".get_user_role() = 'admin');
