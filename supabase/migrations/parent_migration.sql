-- ==============================================================================
-- parent_migration.sql
-- COMPLETE CONSOLIDATED MIGRATION FOR SCHEMA: "sales-pipe"
-- Includes:
-- 1. Schema Init & Grants
-- 2. Leads Table & RLS
-- 3. Tasks Table & RLS
-- 4. Activity Log Table & RLS
-- 5. Outreach Templates Table & RLS
-- 6. Application Logs Table (app_logs) & RLS
-- 7. User Audit Logs Table (user_logs) & RLS
-- 8. Error Logs Table (error_logs) & RLS
-- 9. Cadence Engine Functions & Views
-- 10. Initial Seed Data
-- ==============================================================================

-- 1. CREATE SCHEMA AND PERMISSIONS
CREATE SCHEMA IF NOT EXISTS "sales-pipe";

GRANT USAGE ON SCHEMA "sales-pipe" TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA "sales-pipe" TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA "sales-pipe" TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA "sales-pipe" TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA "sales-pipe" GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA "sales-pipe" GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA "sales-pipe" GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- 2. LEADS TABLE
CREATE SEQUENCE IF NOT EXISTS "sales-pipe".leads_code_seq START WITH 1;

CREATE TABLE IF NOT EXISTS "sales-pipe".leads (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_code text DEFAULT ('LD-' || LPAD(nextval('"sales-pipe".leads_code_seq')::text, 4, '0')),
    business_name text NOT NULL,
    email text,
    phone text,
    instagram_handle text,
    company_type text DEFAULT 'limited',
    channel text NOT NULL CHECK (channel IN ('Email', 'WhatsApp', 'Instagram', 'Phone', 'Walk-in')),
    stage text NOT NULL DEFAULT 'New' CHECK (stage IN ('New', 'Contacted', 'Replied', 'Interested', 'Won', 'Lost', 'Do not contact')),
    follow_up_count int DEFAULT 0,
    next_follow_up date,
    assigned_to text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_lead_code ON "sales-pipe".leads(lead_code);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON "sales-pipe".leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON "sales-pipe".leads(next_follow_up);
CREATE INDEX IF NOT EXISTS idx_leads_channel ON "sales-pipe".leads(channel);

ALTER TABLE "sales-pipe".leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads_full_access" ON "sales-pipe".leads;
CREATE POLICY "leads_full_access" ON "sales-pipe".leads FOR ALL USING (true) WITH CHECK (true);

-- 3. TASKS TABLE
CREATE TABLE IF NOT EXISTS "sales-pipe".tasks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text,
    assigned_to text,
    due_date date DEFAULT CURRENT_DATE,
    status text NOT NULL DEFAULT 'open',
    task_type text NOT NULL DEFAULT 'sales_followup',
    lead_id uuid REFERENCES "sales-pipe".leads(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON "sales-pipe".tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON "sales-pipe".tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON "sales-pipe".tasks(lead_id);

ALTER TABLE "sales-pipe".tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tasks_full_access" ON "sales-pipe".tasks;
CREATE POLICY "tasks_full_access" ON "sales-pipe".tasks FOR ALL USING (true) WITH CHECK (true);

-- 4. ACTIVITY LOG TABLE
CREATE TABLE IF NOT EXISTS "sales-pipe".activity_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id uuid REFERENCES "sales-pipe".leads(id) ON DELETE CASCADE NOT NULL,
    action_type text NOT NULL CHECK (action_type IN ('sent', 'received', 'note', 'system')),
    details text,
    created_at timestamp with time zone DEFAULT now(),
    created_by text
);

CREATE INDEX IF NOT EXISTS idx_activity_log_lead_id ON "sales-pipe".activity_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON "sales-pipe".activity_log(created_at DESC);

ALTER TABLE "sales-pipe".activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activity_log_full_access" ON "sales-pipe".activity_log;
CREATE POLICY "activity_log_full_access" ON "sales-pipe".activity_log FOR ALL USING (true) WITH CHECK (true);

-- 5. TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS "sales-pipe".templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    subject text,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE "sales-pipe".templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "templates_full_access" ON "sales-pipe".templates;
CREATE POLICY "templates_full_access" ON "sales-pipe".templates FOR ALL USING (true) WITH CHECK (true);

INSERT INTO "sales-pipe".templates (name, subject, body) VALUES
('First Outreach (Day 0)', 'Quick question regarding operations at {business_name}', 'Hi there,\n\nI noticed the great work {business_name} is doing. We help businesses streamline customer communications across WhatsApp, Instagram, and Email into a single unified queue.\n\nWould you be open to a quick 5-minute chat this week?\n\nBest regards,\nSales Team'),
('Follow-up 1 (Day 3)', 'Re: Quick question regarding operations at {business_name}', 'Hi team,\n\nFollowing up on my previous note. Wanted to see if you had 5 minutes this week to discuss how we can help {business_name} capture more leads from social channels?\n\nBest regards,\nSales Team'),
('Follow-up 2 (Day 8)', 'Streamlining communication for {business_name}', 'Hi {business_name} team,\n\nJust floating this to the top of your inbox. Happy to share a quick 2-minute demo video if that is easier for you?\n\nBest regards,\nSales Team'),
('Final Check (Day 22)', 'Closing the loop - {business_name}', 'Hi,\n\nI realize you are likely busy. If the timing is not right, no problem at all — I will not follow up again. Feel free to reach out whenever you are ready.\n\nAll the best,\nSales Team'),
('30-Day Upsell (After Won)', 'Checking in on your setup at {business_name}', 'Hi {business_name},\n\nIt has been a month since we launched together! How are things going? Let us schedule a quick catchup to explore multi-channel automation modules.\n\nBest,\nSales Team')
ON CONFLICT DO NOTHING;

-- 6. APP LOGS TABLE
CREATE TABLE IF NOT EXISTS "sales-pipe".app_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event text NOT NULL,
    category text NOT NULL DEFAULT 'system',
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_logs_event ON "sales-pipe".app_logs(event);
CREATE INDEX IF NOT EXISTS idx_app_logs_category ON "sales-pipe".app_logs(category);
CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON "sales-pipe".app_logs(created_at DESC);

ALTER TABLE "sales-pipe".app_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_logs_full_access" ON "sales-pipe".app_logs;
CREATE POLICY "app_logs_full_access" ON "sales-pipe".app_logs FOR ALL USING (true) WITH CHECK (true);

-- 7. USER LOGS TABLE
CREATE TABLE IF NOT EXISTS "sales-pipe".user_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id text DEFAULT 'sales-1',
    user_name text DEFAULT 'Kesav S.',
    action text NOT NULL,
    entity_type text,
    entity_id text,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_logs_action ON "sales-pipe".user_logs(action);
CREATE INDEX IF NOT EXISTS idx_user_logs_entity ON "sales-pipe".user_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_user_logs_created_at ON "sales-pipe".user_logs(created_at DESC);

ALTER TABLE "sales-pipe".user_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_logs_full_access" ON "sales-pipe".user_logs;
CREATE POLICY "user_logs_full_access" ON "sales-pipe".user_logs FOR ALL USING (true) WITH CHECK (true);

-- 8. ERROR LOGS TABLE
CREATE TABLE IF NOT EXISTS "sales-pipe".error_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    error_message text NOT NULL,
    error_stack text,
    context text,
    user_id text DEFAULT 'sales-1',
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_context ON "sales-pipe".error_logs(context);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON "sales-pipe".error_logs(created_at DESC);

ALTER TABLE "sales-pipe".error_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "error_logs_full_access" ON "sales-pipe".error_logs;
CREATE POLICY "error_logs_full_access" ON "sales-pipe".error_logs FOR ALL USING (true) WITH CHECK (true);

-- 9. FUNCTIONS & VIEWS
CREATE OR REPLACE FUNCTION "sales-pipe".add_working_days(start_date date, days int)
RETURNS date AS $$
DECLARE
    result date := start_date;
    added int := 0;
BEGIN
    WHILE added < days LOOP
        result := result + interval '1 day';
        IF extract(dow from result) NOT IN (0, 6) THEN
            added := added + 1;
        END IF;
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION "sales-pipe".record_outreach(
    p_lead_id uuid,
    p_action text,
    p_task_id uuid DEFAULT NULL,
    p_details text DEFAULT NULL,
    p_reply_channel text DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_lead record;
    v_next_date date;
    v_new_stage text;
    v_channel text;
BEGIN
    SELECT * INTO v_lead FROM "sales-pipe".leads WHERE id = p_lead_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found';
    END IF;

    v_next_date := v_lead.next_follow_up;
    v_new_stage := v_lead.stage;
    v_channel := v_lead.channel;

    IF p_reply_channel IS NOT NULL AND p_reply_channel IN ('Email', 'WhatsApp', 'Instagram', 'Phone', 'Walk-in') THEN
        v_channel := p_reply_channel;
    END IF;

    IF p_action = 'sent' THEN
        v_new_stage := 'Contacted';
        IF v_lead.follow_up_count = 0 THEN
            v_next_date := "sales-pipe".add_working_days(CURRENT_DATE, 3);
        ELSIF v_lead.follow_up_count = 1 THEN
            v_next_date := "sales-pipe".add_working_days(CURRENT_DATE, 5);
        ELSIF v_lead.follow_up_count = 2 THEN
            v_next_date := "sales-pipe".add_working_days(CURRENT_DATE, 14);
        END IF;
        
        UPDATE "sales-pipe".leads 
        SET stage = v_new_stage,
            channel = v_channel,
            follow_up_count = follow_up_count + 1,
            next_follow_up = v_next_date
        WHERE id = p_lead_id;

        INSERT INTO "sales-pipe".activity_log (lead_id, action_type, details, created_by)
        VALUES (p_lead_id, 'sent', COALESCE(p_details, 'Message sent via ' || v_channel), 'sales-1');

        INSERT INTO "sales-pipe".user_logs (action, entity_type, entity_id, details)
        VALUES ('record_outreach_sent', 'lead', p_lead_id::text, jsonb_build_object('channel', v_channel, 'follow_up_count', v_lead.follow_up_count + 1));

    ELSIF p_action = 'no_reply_final' THEN
        UPDATE "sales-pipe".leads SET stage = 'Lost', next_follow_up = NULL WHERE id = p_lead_id;
        INSERT INTO "sales-pipe".activity_log (lead_id, action_type, details, created_by)
        VALUES (p_lead_id, 'system', 'Final check: no reply. Marked as lost.', 'system');

        INSERT INTO "sales-pipe".app_logs (event, category, details)
        VALUES ('lead_auto_closed_lost', 'pipeline', jsonb_build_object('lead_id', p_lead_id));

    ELSIF p_action IN ('replied', 'interested', 'won', 'lost', 'do_not_contact', 'new') THEN
        IF p_action = 'new' THEN
            v_new_stage := 'New';
            v_next_date := CURRENT_DATE;
        ELSIF p_action = 'replied' THEN
            v_new_stage := 'Replied';
            v_next_date := NULL;
        ELSIF p_action = 'interested' THEN
            v_new_stage := 'Interested';
            v_next_date := "sales-pipe".add_working_days(CURRENT_DATE, 2);
        ELSIF p_action = 'won' THEN
            v_new_stage := 'Won';
            v_next_date := CURRENT_DATE + interval '30 days';
        ELSIF p_action = 'lost' THEN
            v_new_stage := 'Lost';
            v_next_date := NULL;
        ELSIF p_action = 'do_not_contact' THEN
            v_new_stage := 'Do not contact';
            v_next_date := NULL;
        END IF;

        UPDATE "sales-pipe".leads 
        SET stage = v_new_stage,
            channel = v_channel,
            next_follow_up = v_next_date
        WHERE id = p_lead_id;

        INSERT INTO "sales-pipe".activity_log (lead_id, action_type, details, created_by)
        VALUES (p_lead_id, 'note', 'Stage updated to ' || v_new_stage || CASE WHEN p_reply_channel IS NOT NULL THEN ' via ' || p_reply_channel ELSE '' END, 'sales-1');

        INSERT INTO "sales-pipe".user_logs (action, entity_type, entity_id, details)
        VALUES ('update_stage', 'lead', p_lead_id::text, jsonb_build_object('new_stage', v_new_stage, 'channel', v_channel));
    END IF;

    IF p_task_id IS NOT NULL THEN
        UPDATE "sales-pipe".tasks SET status = 'completed' WHERE id = p_task_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE VIEW "sales-pipe".leads_due_today AS
SELECT * FROM "sales-pipe".leads
WHERE next_follow_up <= CURRENT_DATE
  AND stage NOT IN ('Replied', 'Lost', 'Do not contact');

-- 10. SEED DATA
DO $$
DECLARE
    v_lead1_id uuid;
    v_lead2_id uuid;
    v_lead3_id uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "sales-pipe".leads LIMIT 1) THEN
        INSERT INTO "sales-pipe".leads (
            business_name, email, phone, instagram_handle, company_type, channel, stage, follow_up_count, next_follow_up
        ) VALUES (
            'The Green Bakery', 'hello@thegreenbakery.co.uk', '+447123456789', 'greenbakeryuk', 'sole_trader', 'WhatsApp', 'Contacted', 1, CURRENT_DATE
        ) RETURNING id INTO v_lead1_id;

        INSERT INTO "sales-pipe".tasks (title, description, due_date, status, task_type, lead_id)
        VALUES ('The Green Bakery: Follow-up 1 (WhatsApp)', 'Following up on WhatsApp message. Check menu inquiry.', CURRENT_DATE, 'open', 'sales_followup', v_lead1_id);

        INSERT INTO "sales-pipe".leads (
            business_name, email, phone, instagram_handle, company_type, channel, stage, follow_up_count, next_follow_up
        ) VALUES (
            'Apex Logistics Ltd', 'director@apexlogistics.co.uk', '+447987654321', 'apexlogistics', 'limited', 'Email', 'Contacted', 2, CURRENT_DATE
        ) RETURNING id INTO v_lead2_id;

        INSERT INTO "sales-pipe".tasks (title, description, due_date, status, task_type, lead_id)
        VALUES ('Apex Logistics Ltd: Follow-up 2 (Email)', 'Follow-up regarding commercial fleet booking software.', CURRENT_DATE, 'open', 'sales_followup', v_lead2_id);

        INSERT INTO "sales-pipe".leads (
            business_name, email, phone, instagram_handle, company_type, channel, stage, follow_up_count, next_follow_up
        ) VALUES (
            'Studio Bloom Floral', 'info@bloomstudio.co.uk', '+447555123456', 'bloomstudio.ldn', 'sole_trader', 'Instagram', 'New', 0, CURRENT_DATE
        ) RETURNING id INTO v_lead3_id;

        INSERT INTO "sales-pipe".tasks (title, description, due_date, status, task_type, lead_id)
        VALUES ('Studio Bloom Floral: Send First Outreach (Instagram)', 'Send initial greeting DM on Instagram.', CURRENT_DATE, 'open', 'sales_followup', v_lead3_id);

        INSERT INTO "sales-pipe".app_logs (event, category, details)
        VALUES ('database_seeded', 'setup', jsonb_build_object('leads_count', 3));
    END IF;
END $$;

-- 11. NOTIFICATIONS TABLE (Reminders & Outreach Templates)
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

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_status ON "sales-pipe".notifications(recipient, status, due_at);
CREATE INDEX IF NOT EXISTS idx_notifications_lead_id ON "sales-pipe".notifications(lead_id);
CREATE INDEX IF NOT EXISTS idx_notifications_due_at ON "sales-pipe".notifications(due_at);

ALTER TABLE "sales-pipe".notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_full_access" ON "sales-pipe".notifications;
CREATE POLICY "notifications_full_access" ON "sales-pipe".notifications
    FOR ALL USING (true) WITH CHECK (true);

