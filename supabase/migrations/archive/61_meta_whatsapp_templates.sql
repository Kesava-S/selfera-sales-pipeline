-- ==============================================================================
-- 61_meta_whatsapp_templates.sql
-- WhatsApp Templates: our copy of the message templates in the Meta WhatsApp
-- Business Account (WABA). Meta is the source of truth; this table is refreshed
-- by "Sync from Meta", by creating / editing / deleting from the app, and by
-- Meta's template status webhook. Admins manage them; everyone can read.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

CREATE TABLE IF NOT EXISTS "sales-pipe".meta_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meta_id text UNIQUE,                       -- Meta's template id
    name text NOT NULL CHECK (name ~ '^[a-z0-9_]+$' AND length(name) <= 512),
    language text NOT NULL,                    -- e.g. en_GB
    category text NOT NULL CHECK (category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
    status text NOT NULL DEFAULT 'PENDING',    -- APPROVED, PENDING, REJECTED, PAUSED, DISABLED, IN_APPEAL, DELETED...
    components jsonb NOT NULL DEFAULT '[]'::jsonb,
    rejected_reason text,
    quality_score text,
    last_synced_at timestamptz,
    created_by uuid REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (name, language)
);

CREATE INDEX IF NOT EXISTS idx_meta_templates_status ON "sales-pipe".meta_templates (status);

CREATE OR REPLACE FUNCTION "sales-pipe".meta_templates_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = "sales-pipe", public
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS meta_templates_touch ON "sales-pipe".meta_templates;
CREATE TRIGGER meta_templates_touch BEFORE UPDATE ON "sales-pipe".meta_templates
    FOR EACH ROW EXECUTE FUNCTION "sales-pipe".meta_templates_touch();

ALTER TABLE "sales-pipe".meta_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meta_templates_read ON "sales-pipe".meta_templates;
CREATE POLICY meta_templates_read ON "sales-pipe".meta_templates
    FOR SELECT TO authenticated USING ("sales-pipe".get_user_role() IS NOT NULL);

-- Writes go through the server (service role) after the Meta call succeeds
REVOKE ALL ON "sales-pipe".meta_templates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON "sales-pipe".meta_templates TO authenticated;
GRANT ALL ON "sales-pipe".meta_templates TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe".meta_templates_touch() FROM PUBLIC, anon, authenticated;

COMMIT;
