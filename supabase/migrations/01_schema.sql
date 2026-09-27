-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Existing Tasks table modifications (assuming it exists, otherwise this will fail and we'll catch it or the user can adjust)
-- We add the two new columns requested by the guide.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type text DEFAULT 'general';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS lead_id uuid;

-- Leads table
CREATE TABLE leads (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    business_name text NOT NULL,
    email text,
    channel text NOT NULL CHECK (channel IN ('Email', 'WhatsApp', 'Instagram', 'Phone', 'Walk-in')),
    stage text NOT NULL DEFAULT 'New' CHECK (stage IN ('New', 'Contacted', 'Replied', 'Interested', 'Won', 'Lost', 'Do not contact')),
    follow_up_count int DEFAULT 0,
    next_follow_up date,
    assigned_to uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now()
);

-- Add foreign key from tasks to leads now that leads is created
ALTER TABLE tasks ADD CONSTRAINT fk_tasks_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

-- Activity Log table
CREATE TABLE activity_log (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
    action_type text NOT NULL CHECK (action_type IN ('sent', 'received', 'note', 'system')),
    details text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- Templates table
CREATE TABLE templates (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    subject text,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Row Level Security (RLS) Policies
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view all leads
CREATE POLICY "Users can view all leads" ON leads
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert leads
CREATE POLICY "Users can insert leads" ON leads
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update leads
CREATE POLICY "Users can update leads" ON leads
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow authenticated users to view activity logs
CREATE POLICY "Users can view activity logs" ON activity_log
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert activity logs
CREATE POLICY "Users can insert activity logs" ON activity_log
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to view templates
CREATE POLICY "Users can view templates" ON templates
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to manage templates
CREATE POLICY "Users can insert templates" ON templates
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update templates" ON templates
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete templates" ON templates
    FOR DELETE USING (auth.role() = 'authenticated');
