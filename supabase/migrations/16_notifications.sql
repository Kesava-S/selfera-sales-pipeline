-- ==============================================================================
-- 16_notifications.sql
-- Table: "sales-pipe".notifications
-- In-app notifications, review queues, and cadence alerts per user
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES "sales-pipe".profiles(id) ON DELETE CASCADE,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    link text,
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON "sales-pipe".notifications(user_id, is_read) WHERE NOT is_read;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON "sales-pipe".notifications(created_at DESC);

-- Enable RLS
ALTER TABLE "sales-pipe".notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON "sales-pipe".notifications;
CREATE POLICY "notifications_select_own" ON "sales-pipe".notifications
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR "sales-pipe".get_user_role() = 'admin');

DROP POLICY IF EXISTS "notifications_update_own" ON "sales-pipe".notifications;
CREATE POLICY "notifications_update_own" ON "sales-pipe".notifications
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid() OR "sales-pipe".get_user_role() = 'admin')
    WITH CHECK (user_id = auth.uid() OR "sales-pipe".get_user_role() = 'admin');

DROP POLICY IF EXISTS "notifications_insert" ON "sales-pipe".notifications;
CREATE POLICY "notifications_insert" ON "sales-pipe".notifications
    FOR INSERT TO authenticated
    WITH CHECK (true);
