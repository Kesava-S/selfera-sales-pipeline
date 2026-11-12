-- ==============================================================================
-- 13_drafts.sql
-- Table: "sales-pipe".drafts
-- Unsent message drafts per user and thread
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".drafts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id uuid NOT NULL REFERENCES "sales-pipe".threads(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES "sales-pipe".profiles(id) ON DELETE CASCADE,
    subject text,
    body text NOT NULL,
    attachments jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_drafts_thread_user ON "sales-pipe".drafts(thread_id, user_id);

-- Enable RLS
ALTER TABLE "sales-pipe".drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drafts_select" ON "sales-pipe".drafts;
CREATE POLICY "drafts_select" ON "sales-pipe".drafts
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR "sales-pipe".get_user_role() = 'admin');

DROP POLICY IF EXISTS "drafts_manage" ON "sales-pipe".drafts;
CREATE POLICY "drafts_manage" ON "sales-pipe".drafts
    FOR ALL TO authenticated
    USING (user_id = auth.uid() OR "sales-pipe".get_user_role() = 'admin')
    WITH CHECK (user_id = auth.uid() OR "sales-pipe".get_user_role() = 'admin');
