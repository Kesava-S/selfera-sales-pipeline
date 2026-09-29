-- ==============================================================================
-- 02_leads.sql
-- Table: "sales-pipe".leads
-- ==============================================================================

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_lead_code ON "sales-pipe".leads(lead_code);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON "sales-pipe".leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON "sales-pipe".leads(next_follow_up);
CREATE INDEX IF NOT EXISTS idx_leads_channel ON "sales-pipe".leads(channel);

-- Enable RLS
ALTER TABLE "sales-pipe".leads ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Full access for anon & authenticated
DROP POLICY IF EXISTS "leads_full_access" ON "sales-pipe".leads;
CREATE POLICY "leads_full_access" ON "sales-pipe".leads
    FOR ALL USING (true) WITH CHECK (true);
