-- ==============================================================================
-- 04_activity_log.sql
-- Table: "sales-pipe".activity_log
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".activity_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id uuid REFERENCES "sales-pipe".leads(id) ON DELETE CASCADE NOT NULL,
    action_type text NOT NULL CHECK (action_type IN ('sent', 'received', 'note', 'system')),
    details text,
    created_at timestamp with time zone DEFAULT now(),
    created_by text
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_log_lead_id ON "sales-pipe".activity_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON "sales-pipe".activity_log(created_at DESC);

-- Enable RLS
ALTER TABLE "sales-pipe".activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Full access for anon & authenticated
DROP POLICY IF EXISTS "activity_log_full_access" ON "sales-pipe".activity_log;
CREATE POLICY "activity_log_full_access" ON "sales-pipe".activity_log
    FOR ALL USING (true) WITH CHECK (true);
