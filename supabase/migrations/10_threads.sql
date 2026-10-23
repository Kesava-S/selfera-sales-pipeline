-- ==============================================================================
-- 10_threads.sql
-- Table: "sales-pipe".threads
-- Communication threads per platform attached to pipeline opportunities
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".threads (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    opportunity_id uuid NOT NULL REFERENCES "sales-pipe".opportunities(id) ON DELETE CASCADE,
    platform text NOT NULL CHECK (platform IN ('Email', 'WhatsApp', 'Instagram', 'LinkedIn', 'Phone', 'Walk-in')),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting_reply', 'replied', 'closed')),
    last_message_at timestamptz,
    unread_count int DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_threads_opportunity ON "sales-pipe".threads(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_threads_platform ON "sales-pipe".threads(platform);
CREATE INDEX IF NOT EXISTS idx_threads_status ON "sales-pipe".threads(status);
CREATE INDEX IF NOT EXISTS idx_threads_last_msg ON "sales-pipe".threads(last_message_at DESC);

-- Enable RLS
ALTER TABLE "sales-pipe".threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "threads_select" ON "sales-pipe".threads;
CREATE POLICY "threads_select" ON "sales-pipe".threads
    FOR SELECT TO authenticated
    USING ("sales-pipe".get_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "threads_manage" ON "sales-pipe".threads;
CREATE POLICY "threads_manage" ON "sales-pipe".threads
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales', 'consultant'))
    WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales', 'consultant'));
