-- ==============================================================================
-- 11_notifications.sql
-- Table: "sales-pipe".notifications
-- Reminders and outreach notifications for admin/staff with pre-filled templates
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id uuid REFERENCES "sales-pipe".leads(id) ON DELETE CASCADE,
    recipient text NOT NULL DEFAULT 'admin',
    title text NOT NULL,
    message text,
    channel text NOT NULL DEFAULT 'Email',
    template_name text,
    template_subject text,
    template_body text,
    reminder_type text NOT NULL DEFAULT 'cadence' CHECK (reminder_type IN ('cadence', 'custom_reminder', 'overdue', 'upsell', 'interested')),
    duration_label text,
    due_at timestamp with time zone NOT NULL DEFAULT now(),
    is_read boolean DEFAULT false,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'completed', 'dismissed', 'snoozed')),
    created_at timestamp with time zone DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_status ON "sales-pipe".notifications(recipient, status, due_at);
CREATE INDEX IF NOT EXISTS idx_notifications_lead_id ON "sales-pipe".notifications(lead_id);
CREATE INDEX IF NOT EXISTS idx_notifications_due_at ON "sales-pipe".notifications(due_at);

-- Enable RLS
ALTER TABLE "sales-pipe".notifications ENABLE ROW LEVEL SECURITY;

-- Full access policy for authenticated and anon roles
DROP POLICY IF EXISTS "notifications_full_access" ON "sales-pipe".notifications;
CREATE POLICY "notifications_full_access" ON "sales-pipe".notifications
    FOR ALL USING (true) WITH CHECK (true);
