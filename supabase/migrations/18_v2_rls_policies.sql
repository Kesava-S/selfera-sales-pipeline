-- ==============================================================================
-- 18_v2_rls_policies.sql
-- Row Level Security for Selfera Sales Dashboard v2
-- ==============================================================================

SET search_path TO "sales-pipe", public;

-- ==============================================================================
-- ENABLE RLS
-- ==============================================================================

ALTER TABLE "sales-pipe".profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe".businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe".opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe".threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe".messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe".templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe".drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe".consultation_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe".stage_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe".notifications ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- PROFILES
-- ==============================================================================
-- Profiles can be read by anyone authenticated. Admins can manage them.
CREATE POLICY "Profiles read" ON "sales-pipe".profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Profiles manage admin" ON "sales-pipe".profiles FOR ALL USING (
    (SELECT role FROM "sales-pipe".profiles WHERE id = auth.uid()) = 'admin'
) WITH CHECK (
    (SELECT role FROM "sales-pipe".profiles WHERE id = auth.uid()) = 'admin'
);

-- ==============================================================================
-- BUSINESSES
-- ==============================================================================
-- All authenticated users can read and create businesses
CREATE POLICY "Businesses read" ON "sales-pipe".businesses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Businesses insert" ON "sales-pipe".businesses FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Businesses update" ON "sales-pipe".businesses FOR UPDATE USING (auth.role() = 'authenticated');

-- ==============================================================================
-- OPPORTUNITIES
-- ==============================================================================
-- Read: admin (all), sales (assigned to them), consultant (assigned to them)
CREATE POLICY "Opportunities read" ON "sales-pipe".opportunities FOR SELECT USING (
    auth.role() = 'authenticated' AND (
        (SELECT role FROM "sales-pipe".profiles WHERE id = auth.uid()) = 'admin'
        OR assigned_sales_id = auth.uid()
        OR assigned_consultant_id = auth.uid()
        -- Also let them read if unassigned (so they can see new imports before assignment)
        OR (assigned_sales_id IS NULL AND assigned_consultant_id IS NULL)
    )
);

CREATE POLICY "Opportunities insert" ON "sales-pipe".opportunities FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Opportunities update" ON "sales-pipe".opportunities FOR UPDATE USING (
    auth.role() = 'authenticated' AND (
        (SELECT role FROM "sales-pipe".profiles WHERE id = auth.uid()) = 'admin'
        OR assigned_sales_id = auth.uid()
        OR assigned_consultant_id = auth.uid()
    )
);

-- ==============================================================================
-- THREADS, MESSAGES, DRAFTS, STAGE_CHANGES
-- ==============================================================================
-- These cascade off the opportunity permissions
CREATE POLICY "Threads access" ON "sales-pipe".threads FOR ALL USING (
    EXISTS (SELECT 1 FROM "sales-pipe".opportunities o WHERE o.id = opportunity_id)
);

CREATE POLICY "Messages access" ON "sales-pipe".messages FOR ALL USING (
    EXISTS (SELECT 1 FROM "sales-pipe".threads t JOIN "sales-pipe".opportunities o ON t.opportunity_id = o.id WHERE t.id = thread_id)
);

CREATE POLICY "Drafts access" ON "sales-pipe".drafts FOR ALL USING (
    EXISTS (SELECT 1 FROM "sales-pipe".threads t JOIN "sales-pipe".opportunities o ON t.opportunity_id = o.id WHERE t.id = thread_id)
);

CREATE POLICY "Stage_changes access" ON "sales-pipe".stage_changes FOR ALL USING (
    EXISTS (SELECT 1 FROM "sales-pipe".opportunities o WHERE o.id = opportunity_id)
);

-- ==============================================================================
-- TEMPLATES
-- ==============================================================================
-- All roles read, only admin writes
CREATE POLICY "Templates read" ON "sales-pipe".templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Templates write admin" ON "sales-pipe".templates FOR ALL USING (
    (SELECT role FROM "sales-pipe".profiles WHERE id = auth.uid()) = 'admin'
);

-- ==============================================================================
-- CONSULTATION BOOKINGS
-- ==============================================================================
-- Insert only via service role (API). Read by admin and assigned sales.
CREATE POLICY "Consultation bookings read admin" ON "sales-pipe".consultation_bookings FOR SELECT USING (
    (SELECT role FROM "sales-pipe".profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Consultation bookings read sales" ON "sales-pipe".consultation_bookings FOR SELECT USING (
    EXISTS (SELECT 1 FROM "sales-pipe".opportunities o WHERE o.id = matched_opportunity_id AND o.assigned_sales_id = auth.uid())
);
CREATE POLICY "Consultation bookings update admin" ON "sales-pipe".consultation_bookings FOR UPDATE USING (
    (SELECT role FROM "sales-pipe".profiles WHERE id = auth.uid()) = 'admin'
);

-- ==============================================================================
-- NOTIFICATIONS
-- ==============================================================================
-- Users only see their own
CREATE POLICY "Notifications access" ON "sales-pipe".notifications FOR ALL USING (
    user_id = auth.uid()
);

-- ==============================================================================
-- PERMISSIONS GRANTS
-- ==============================================================================
-- Revoke anon access from ALL tables in schema
DO $$ 
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'sales-pipe'
    LOOP
        EXECUTE 'REVOKE ALL ON TABLE "sales-pipe".' || quote_ident(t) || ' FROM anon;';
        EXECUTE 'GRANT ALL ON TABLE "sales-pipe".' || quote_ident(t) || ' TO authenticated, service_role;';
    END LOOP;
END $$;
