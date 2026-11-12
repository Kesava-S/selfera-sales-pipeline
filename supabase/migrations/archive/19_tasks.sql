-- ==============================================================================
-- 19_tasks.sql
-- Table: "sales-pipe".tasks
-- Scheduled follow-up tasks, calls, and actions assigned to team members
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id uuid REFERENCES "sales-pipe".opportunities(id) ON DELETE CASCADE,
    business_id uuid REFERENCES "sales-pipe".businesses(id) ON DELETE CASCADE,
    assigned_to uuid REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL,
    title text NOT NULL,
    description text,
    due_at timestamptz,
    status text NOT NULL DEFAULT 'pending',
    priority text NOT NULL DEFAULT 'normal',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_opp ON "sales-pipe".tasks(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_tasks_biz ON "sales-pipe".tasks(business_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON "sales-pipe".tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON "sales-pipe".tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON "sales-pipe".tasks(due_at);

-- Enable RLS
ALTER TABLE "sales-pipe".tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_select" ON "sales-pipe".tasks;
CREATE POLICY "tasks_select" ON "sales-pipe".tasks
    FOR SELECT TO authenticated
    USING ("sales-pipe".get_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "tasks_manage" ON "sales-pipe".tasks;
CREATE POLICY "tasks_manage" ON "sales-pipe".tasks
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales', 'consultant'))
    WITH CHECK ("sales-pipe".get_user_role() IN ('admin', 'sales', 'consultant'));
