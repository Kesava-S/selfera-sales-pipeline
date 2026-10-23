-- ==============================================================================
-- 11_messages.sql
-- Table: "sales-pipe".messages
-- Inbound and outbound communications history per thread
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id uuid NOT NULL REFERENCES "sales-pipe".threads(id) ON DELETE CASCADE,
    direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    sender_id uuid REFERENCES "sales-pipe".profiles(id),
    subject text,
    body text NOT NULL,
    attachments jsonb DEFAULT '[]'::jsonb,
    is_read boolean DEFAULT false,
    external_id text,
    created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_thread ON "sales-pipe".messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON "sales-pipe".messages(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON "sales-pipe".messages(is_read) WHERE NOT is_read;
CREATE INDEX IF NOT EXISTS idx_messages_external_id ON "sales-pipe".messages(external_id) WHERE external_id IS NOT NULL;

-- Enable RLS
ALTER TABLE "sales-pipe".messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select" ON "sales-pipe".messages;
CREATE POLICY "messages_select" ON "sales-pipe".messages
    FOR SELECT TO authenticated
    USING ("sales-pipe".get_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "messages_manage" ON "sales-pipe".messages;
CREATE POLICY "messages_manage" ON "sales-pipe".messages
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales', 'consultant'))
    WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales', 'consultant'));
