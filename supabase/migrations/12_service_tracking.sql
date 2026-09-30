-- ==============================================================================
-- 12_service_tracking.sql
-- Multi-Service Tracking, Service Pivot Evolution, and Audit History
-- Schema: "sales-pipe"
-- ==============================================================================

-- 1. EXTEND LEADS TABLE WITH SERVICE TRACKING COLUMNS
ALTER TABLE "sales-pipe".leads
ADD COLUMN IF NOT EXISTS initial_service text DEFAULT 'Website Services',
ADD COLUMN IF NOT EXISTS current_service text DEFAULT 'Website Services',
ADD COLUMN IF NOT EXISTS agreed_service text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS service_notes text DEFAULT NULL;

-- Ensure service check constraints support both single services and combo bundles
ALTER TABLE "sales-pipe".leads DROP CONSTRAINT IF EXISTS check_initial_service;
ALTER TABLE "sales-pipe".leads DROP CONSTRAINT IF EXISTS check_current_service;
ALTER TABLE "sales-pipe".leads DROP CONSTRAINT IF EXISTS check_agreed_service;

-- Indexes for fast query filtering
CREATE INDEX IF NOT EXISTS idx_leads_initial_service ON "sales-pipe".leads(initial_service);
CREATE INDEX IF NOT EXISTS idx_leads_current_service ON "sales-pipe".leads(current_service);
CREATE INDEX IF NOT EXISTS idx_leads_agreed_service ON "sales-pipe".leads(agreed_service);

-- 2. CREATE IMMUTABLE SERVICE HISTORY / AUDIT TABLE
CREATE TABLE IF NOT EXISTS "sales-pipe".lead_service_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id uuid REFERENCES "sales-pipe".leads(id) ON DELETE CASCADE NOT NULL,
    business_name text NOT NULL,
    from_service text NOT NULL,
    to_service text NOT NULL,
    transition_stage text NOT NULL,
    reason text NOT NULL,
    changed_by text DEFAULT 'Sales Team',
    created_at timestamp with time zone DEFAULT now()
);

-- Indexes for service history analytics
CREATE INDEX IF NOT EXISTS idx_service_history_lead ON "sales-pipe".lead_service_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_service_history_services ON "sales-pipe".lead_service_history(from_service, to_service);
CREATE INDEX IF NOT EXISTS idx_service_history_created_at ON "sales-pipe".lead_service_history(created_at DESC);

-- Enable Row Level Security
ALTER TABLE "sales-pipe".lead_service_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Full access for anon & authenticated
DROP POLICY IF EXISTS "service_history_full_access" ON "sales-pipe".lead_service_history;
CREATE POLICY "service_history_full_access" ON "sales-pipe".lead_service_history
    FOR ALL USING (true) WITH CHECK (true);

-- 3. PERMISSIONS GRANT
GRANT ALL ON TABLE "sales-pipe".lead_service_history TO anon, authenticated, service_role;
