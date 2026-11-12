-- ==============================================================================
-- 03_business_categories.sql
-- Table: "sales-pipe".business_categories
-- Dynamic business category definitions, icons, and classification synonyms
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".business_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    slug text NOT NULL UNIQUE,
    icon_name text DEFAULT 'Building2',
    description text,
    category_group text,
    synonyms text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_categories_active ON "sales-pipe".business_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_business_categories_slug ON "sales-pipe".business_categories(slug);

-- Enable RLS
ALTER TABLE "sales-pipe".business_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_categories_read" ON "sales-pipe".business_categories;
CREATE POLICY "business_categories_read" ON "sales-pipe".business_categories
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "business_categories_admin_manage" ON "sales-pipe".business_categories;
CREATE POLICY "business_categories_admin_manage" ON "sales-pipe".business_categories
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() = 'admin')
    WITH CHECK ("sales-pipe".get_user_role() = 'admin');
