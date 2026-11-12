-- ==============================================================================
-- 09_opportunities.sql
-- Table: "sales-pipe".opportunities
-- Pipeline opportunities (pitches), stages, assignments, and values
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".opportunities (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    opportunity_code text UNIQUE,
    business_id uuid NOT NULL REFERENCES "sales-pipe".businesses(id) ON DELETE CASCADE,
    services_pitched text[] NOT NULL DEFAULT '{}'::text[],
    stage text NOT NULL DEFAULT 'Identified' CHECK (stage IN (
        'Identified',
        'Outreach queued',
        'Outreach sent',
        'Follow-up 1',
        'Follow-up 2',
        'Replied - positive',
        'Replied - negative',
        'Audit delivered',
        'Call booked',
        'Call completed',
        'Closed - won',
        'Closed - lost'
    )),
    assigned_sales_id uuid REFERENCES "sales-pipe".profiles(id),
    assigned_consultant_id uuid REFERENCES "sales-pipe".profiles(id),
    deal_value numeric,
    expected_close_date date,
    stage_entered_at timestamptz DEFAULT now(),
    archived boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_opps_business ON "sales-pipe".opportunities(business_id);
CREATE INDEX IF NOT EXISTS idx_opps_stage ON "sales-pipe".opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_opps_assigned_sales ON "sales-pipe".opportunities(assigned_sales_id);
CREATE INDEX IF NOT EXISTS idx_opps_assigned_consultant ON "sales-pipe".opportunities(assigned_consultant_id);
CREATE INDEX IF NOT EXISTS idx_opps_archived ON "sales-pipe".opportunities(archived);
CREATE INDEX IF NOT EXISTS idx_opps_stage_entered ON "sales-pipe".opportunities(stage_entered_at);

-- Opportunity Code Trigger
CREATE OR REPLACE FUNCTION "sales-pipe".generate_opportunity_code()
RETURNS trigger AS $$
DECLARE
    next_id int;
BEGIN
    IF NEW.opportunity_code IS NULL THEN
        SELECT COUNT(*) + 1 INTO next_id FROM "sales-pipe".opportunities;
        NEW.opportunity_code := 'OP-' || LPAD(next_id::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'sales-pipe', 'public';

DROP TRIGGER IF EXISTS trg_generate_opportunity_code ON "sales-pipe".opportunities;
CREATE TRIGGER trg_generate_opportunity_code
    BEFORE INSERT ON "sales-pipe".opportunities
    FOR EACH ROW EXECUTE FUNCTION "sales-pipe".generate_opportunity_code();

-- Enable RLS
ALTER TABLE "sales-pipe".opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "opportunities_select" ON "sales-pipe".opportunities;
CREATE POLICY "opportunities_select" ON "sales-pipe".opportunities
    FOR SELECT TO authenticated
    USING ("sales-pipe".get_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "opportunities_admin_manage" ON "sales-pipe".opportunities;
CREATE POLICY "opportunities_admin_manage" ON "sales-pipe".opportunities
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() = 'admin')
    WITH CHECK ("sales-pipe".get_user_role() = 'admin');

DROP POLICY IF EXISTS "opportunities_sales_consultant_manage" ON "sales-pipe".opportunities;
CREATE POLICY "opportunities_sales_consultant_manage" ON "sales-pipe".opportunities
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('sales', 'consultant'))
    WITH CHECK ("sales-pipe".get_user_role() IN ('sales', 'consultant'));
