-- ==============================================================================
-- 03_tasks.sql
-- Table: "sales-pipe".tasks
-- ==============================================================================

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_status ON "sales-pipe".tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON "sales-pipe".tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON "sales-pipe".tasks(lead_id);

-- Enable RLS
ALTER TABLE "sales-pipe".tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Full access for anon & authenticated
DROP POLICY IF EXISTS "tasks_full_access" ON "sales-pipe".tasks;
CREATE POLICY "tasks_full_access" ON "sales-pipe".tasks
    FOR ALL USING (true) WITH CHECK (true);
