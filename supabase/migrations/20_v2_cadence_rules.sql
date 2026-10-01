-- ==============================================================================
-- 20_v2_cadence_rules.sql
-- Follow-up timings shown in Settings. Safe to re-run.
-- ==============================================================================

-- If an earlier run created it in the public schema by mistake, move it
DO $$
BEGIN
  IF to_regclass('public.cadence_rules') IS NOT NULL AND to_regclass('"sales-pipe".cadence_rules') IS NULL THEN
    ALTER TABLE public.cadence_rules SET SCHEMA "sales-pipe";
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "sales-pipe".cadence_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_name text NOT NULL UNIQUE,
  days_delay integer NOT NULL CHECK (days_delay > 0),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "sales-pipe".cadence_rules (step_name, days_delay, description) VALUES
  ('Follow up 1', 3, 'Working days after First contact before Follow-up 1'),
  ('Follow up 2', 5, 'Working days after Follow-up 1 before Follow-up 2'),
  ('Follow up 3', 14, 'Working days after Follow-up 2 before the Final check'),
  ('Went Cold', 14, 'Working days after the Final check before No response')
ON CONFLICT (step_name) DO NOTHING;

ALTER TABLE "sales-pipe".cadence_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cadence read" ON "sales-pipe".cadence_rules;
CREATE POLICY "Cadence read" ON "sales-pipe".cadence_rules FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Cadence write admin" ON "sales-pipe".cadence_rules;
CREATE POLICY "Cadence write admin" ON "sales-pipe".cadence_rules FOR UPDATE
  USING ((SELECT role FROM "sales-pipe".profiles WHERE id = auth.uid()) = 'admin');

REVOKE ALL ON "sales-pipe".cadence_rules FROM anon, public;
GRANT SELECT, UPDATE ON "sales-pipe".cadence_rules TO authenticated;
GRANT ALL ON "sales-pipe".cadence_rules TO service_role;
