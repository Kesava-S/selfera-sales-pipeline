-- ==============================================================================
-- 14_consultation_bookings.sql
-- Table: "sales-pipe".consultation_bookings
-- Consultant calls and booked meetings linked to opportunities
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".consultation_bookings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    opportunity_id uuid NOT NULL REFERENCES "sales-pipe".opportunities(id) ON DELETE CASCADE,
    consultant_id uuid REFERENCES "sales-pipe".profiles(id),
    scheduled_at timestamptz NOT NULL,
    duration_minutes int DEFAULT 30,
    meeting_link text,
    status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_opportunity ON "sales-pipe".consultation_bookings(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_bookings_consultant ON "sales-pipe".consultation_bookings(consultant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled ON "sales-pipe".consultation_bookings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON "sales-pipe".consultation_bookings(status);

-- Enable RLS
ALTER TABLE "sales-pipe".consultation_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookings_select" ON "sales-pipe".consultation_bookings;
CREATE POLICY "bookings_select" ON "sales-pipe".consultation_bookings
    FOR SELECT TO authenticated
    USING ("sales-pipe".get_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "bookings_manage" ON "sales-pipe".consultation_bookings;
CREATE POLICY "bookings_manage" ON "sales-pipe".consultation_bookings
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales', 'consultant'))
    WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales', 'consultant'));
