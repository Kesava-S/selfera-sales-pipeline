-- ==============================================================================
-- 66_message_meta_template.sql
-- Which approved Meta template a WhatsApp message was sent as (outside the
-- 24-hour window), so the chat can show it. NULL = a normal message.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

ALTER TABLE "sales-pipe".messages ADD COLUMN IF NOT EXISTS meta_template text;

COMMIT;

NOTIFY pgrst, 'reload schema';
