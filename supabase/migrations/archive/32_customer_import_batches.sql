-- ==============================================================================
-- 32_customer_import_batches.sql
-- Table: "sales-pipe".customer_import_batches
-- One row per customer leads CSV upload batch
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".customer_import_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES "sales-pipe".businesses(id) ON DELETE CASCADE,
    file_name text,
    created_count int NOT NULL DEFAULT 0,
    updated_count int NOT NULL DEFAULT 0,
    skipped_count int NOT NULL DEFAULT 0,
    created_by uuid DEFAULT auth.uid() REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_import_batches_biz ON "sales-pipe".customer_import_batches(business_id, created_at DESC);

-- Enable RLS
ALTER TABLE "sales-pipe".customer_import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_import_batches_access ON "sales-pipe".customer_import_batches;
CREATE POLICY customer_import_batches_access ON "sales-pipe".customer_import_batches
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales'))
    WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales'));

REVOKE ALL ON "sales-pipe".customer_import_batches FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON "sales-pipe".customer_import_batches TO authenticated, service_role;

