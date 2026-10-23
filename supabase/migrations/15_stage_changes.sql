-- ==============================================================================
-- 15_stage_changes.sql
-- Table: "sales-pipe".stage_changes
-- Audit log of pipeline stage transitions and rationale
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".stage_changes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    opportunity_id uuid NOT NULL REFERENCES "sales-pipe".opportunities(id) ON DELETE CASCADE,
    from_stage text,
    to_stage text NOT NULL,
    changed_by uuid REFERENCES "sales-pipe".profiles(id),
    reason text,
    created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stage_changes_opp ON "sales-pipe".stage_changes(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_stage_changes_created ON "sales-pipe".stage_changes(created_at DESC);

-- Enable RLS
ALTER TABLE "sales-pipe".stage_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stage_changes_select" ON "sales-pipe".stage_changes;
CREATE POLICY "stage_changes_select" ON "sales-pipe".stage_changes
    FOR SELECT TO authenticated
    USING ("sales-pipe".get_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "stage_changes_insert" ON "sales-pipe".stage_changes;
CREATE POLICY "stage_changes_insert" ON "sales-pipe".stage_changes
    FOR INSERT TO authenticated
    WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales', 'consultant'));
