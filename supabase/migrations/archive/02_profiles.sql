-- ==============================================================================
-- 02_profiles.sql
-- Table: "sales-pipe".profiles
-- Stores user accounts, roles, and sales pipeline capacities
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    full_name text NOT NULL,
    role text NOT NULL CHECK (role IN ('admin', 'sales', 'consultant')),
    display_role text,
    capacity int DEFAULT 50,
    is_active boolean DEFAULT true,
    avatar_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON "sales-pipe".profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON "sales-pipe".profiles(is_active);

-- Enable RLS
ALTER TABLE "sales-pipe".profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_policy" ON "sales-pipe".profiles;
CREATE POLICY "profiles_select_policy" ON "sales-pipe".profiles
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "profiles_admin_all" ON "sales-pipe".profiles;
CREATE POLICY "profiles_admin_all" ON "sales-pipe".profiles
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() = 'admin' OR id = auth.uid())
    WITH CHECK ("sales-pipe".get_user_role() = 'admin' OR id = auth.uid());
