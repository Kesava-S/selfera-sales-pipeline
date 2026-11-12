-- ==============================================================================
-- 20_opt_outs.sql
-- Table: "sales-pipe".opt_outs
-- Suppression registry for unsubscribed and opted-out contacts
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".opt_outs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier text NOT NULL,
    channel text NOT NULL DEFAULT 'All',
    reason text,
    source text DEFAULT 'inbound',
    created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_opt_outs_identifier ON "sales-pipe".opt_outs(identifier);
CREATE INDEX IF NOT EXISTS idx_opt_outs_identifier_lower ON "sales-pipe".opt_outs (lower(identifier));
CREATE INDEX IF NOT EXISTS idx_opt_outs_channel ON "sales-pipe".opt_outs(channel);

-- Enable RLS
ALTER TABLE "sales-pipe".opt_outs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "opt_outs_select" ON "sales-pipe".opt_outs;
CREATE POLICY "opt_outs_select" ON "sales-pipe".opt_outs
    FOR SELECT TO authenticated
    USING ("sales-pipe".get_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "opt_outs_manage" ON "sales-pipe".opt_outs;
CREATE POLICY "opt_outs_manage" ON "sales-pipe".opt_outs
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales'))
    WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales'));
