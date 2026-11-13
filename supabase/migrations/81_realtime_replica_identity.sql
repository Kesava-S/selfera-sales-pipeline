-- ==============================================================================
-- 81_realtime_replica_identity.sql
-- Enable REPLICA IDENTITY FULL on tables published to supabase_realtime.
-- This ensures that PostgreSQL logical replication and Supabase Realtime
-- receive the full row on UPDATE and DELETE events, allowing client-side
-- filters (such as thread_id=eq.<id> or user_id=eq.<id>) to match and broadcast.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

ALTER TABLE "sales-pipe"."messages" REPLICA IDENTITY FULL;
ALTER TABLE "sales-pipe"."threads" REPLICA IDENTITY FULL;
ALTER TABLE "sales-pipe"."opportunities" REPLICA IDENTITY FULL;
ALTER TABLE "sales-pipe"."campaign_replies" REPLICA IDENTITY FULL;
ALTER TABLE "sales-pipe"."notifications" REPLICA IDENTITY FULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
