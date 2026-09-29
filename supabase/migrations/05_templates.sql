-- ==============================================================================
-- 05_templates.sql
-- Table: "sales-pipe".templates
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    subject text,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE "sales-pipe".templates ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Full access for anon & authenticated
DROP POLICY IF EXISTS "templates_full_access" ON "sales-pipe".templates;
CREATE POLICY "templates_full_access" ON "sales-pipe".templates
    FOR ALL USING (true) WITH CHECK (true);

-- Seed initial default cadence templates
INSERT INTO "sales-pipe".templates (name, subject, body) VALUES
('First Outreach (Day 0)', 'Quick question regarding operations at {business_name}', 'Hi there,\n\nI noticed the great work {business_name} is doing. We help businesses streamline customer communications across WhatsApp, Instagram, and Email into a single unified queue.\n\nWould you be open to a quick 5-minute chat this week?\n\nBest regards,\nSales Team'),
('Follow-up 1 (Day 3)', 'Re: Quick question regarding operations at {business_name}', 'Hi team,\n\nFollowing up on my previous note. Wanted to see if you had 5 minutes this week to discuss how we can help {business_name} capture more leads from social channels?\n\nBest regards,\nSales Team'),
('Follow-up 2 (Day 8)', 'Streamlining communication for {business_name}', 'Hi {business_name} team,\n\nJust floating this to the top of your inbox. Happy to share a quick 2-minute demo video if that is easier for you?\n\nBest regards,\nSales Team'),
('Final Check (Day 22)', 'Closing the loop - {business_name}', 'Hi,\n\nI realize you are likely busy. If the timing is not right, no problem at all — I will not follow up again. Feel free to reach out whenever you are ready.\n\nAll the best,\nSales Team'),
('30-Day Upsell (After Won)', 'Checking in on your setup at {business_name}', 'Hi {business_name},\n\nIt has been a month since we launched together! How are things going? Let us schedule a quick catchup to explore multi-channel automation modules.\n\nBest,\nSales Team')
ON CONFLICT DO NOTHING;
