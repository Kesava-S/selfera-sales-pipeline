-- ==============================================================================
-- 07_import_batches.sql
-- Table: "sales-pipe".import_batches
-- Tracks bulk CSV imports, validation queues, and processing tallies
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".import_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name text NOT NULL,
    uploaded_by uuid REFERENCES "sales-pipe".profiles(id),
    total_rows int DEFAULT 0,
    ready_count int DEFAULT 0,
    missing_count int DEFAULT 0,
    failed_count int DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_batches_uploaded_by ON "sales-pipe".import_batches(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_import_batches_created_at ON "sales-pipe".import_batches(created_at DESC);

-- Enable RLS
ALTER TABLE "sales-pipe".import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_batches_read" ON "sales-pipe".import_batches;
CREATE POLICY "import_batches_read" ON "sales-pipe".import_batches
    FOR SELECT TO authenticated
    USING ("sales-pipe".get_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "import_batches_manage" ON "sales-pipe".import_batches;
CREATE POLICY "import_batches_manage" ON "sales-pipe".import_batches
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales'))
    WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales'));
