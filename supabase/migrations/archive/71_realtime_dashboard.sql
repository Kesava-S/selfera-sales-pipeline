-- ==============================================================================
-- 71_realtime_dashboard.sql
-- Live dashboard counts: send changes to pitches (stage, assignment), chats
-- (status, due date) and campaign replies over Supabase realtime, so the
-- dashboard and status pages refresh without a reload. messages and
-- notifications are already published. Row rules (RLS) still decide who
-- receives which change.
-- ==============================================================================

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['opportunities', 'threads', 'campaign_replies'] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'sales-pipe' AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I.%I', 'sales-pipe', t);
        END IF;
    END LOOP;
END $$;
