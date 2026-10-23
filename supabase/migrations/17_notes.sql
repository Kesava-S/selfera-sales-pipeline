-- ==============================================================================
-- 17_notes.sql
-- Table: "sales-pipe".notes
-- Internal team notes attached to opportunities or businesses
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id uuid REFERENCES "sales-pipe".opportunities(id) ON DELETE CASCADE,
    business_id uuid REFERENCES "sales-pipe".businesses(id) ON DELETE CASCADE,
    author_id uuid REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL,
    body text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notes_opp ON "sales-pipe".notes(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_notes_biz ON "sales-pipe".notes(business_id);
CREATE INDEX IF NOT EXISTS idx_notes_created ON "sales-pipe".notes(created_at DESC);

-- Enable RLS
ALTER TABLE "sales-pipe".notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notes_select" ON "sales-pipe".notes;
CREATE POLICY "notes_select" ON "sales-pipe".notes
    FOR SELECT TO authenticated
    USING ("sales-pipe".get_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "notes_manage" ON "sales-pipe".notes;
CREATE POLICY "notes_manage" ON "sales-pipe".notes
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales', 'consultant'))
    WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales', 'consultant'));
