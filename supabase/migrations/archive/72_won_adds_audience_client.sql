-- ==============================================================================
-- 72_won_adds_audience_client.sql
-- A lead marked Won becomes a Client Audience client straight away (a row in
-- audience_clients), so it is listed there ready for its customers.
--
-- * Nothing else changes: marketing to the client's customers still needs the
--   agreement date (audience_unlocked = Won + dpa_signed_on), set by an admin.
-- * Reopening a Won lead keeps the client (remove it by hand if needed);
--   campaigns pause on their own because the lead is no longer Won.
-- * source: 'won' (added automatically) or 'manual' (added by staff).
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

ALTER TABLE "sales-pipe".audience_clients
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS added_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE "sales-pipe".audience_clients DROP CONSTRAINT IF EXISTS audience_clients_source_check;
ALTER TABLE "sales-pipe".audience_clients ADD CONSTRAINT audience_clients_source_check CHECK (source IN ('won', 'manual'));

CREATE OR REPLACE FUNCTION "sales-pipe".trg_won_adds_audience_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
BEGIN
    INSERT INTO "sales-pipe".audience_clients (business_id, source, added_at, updated_at)
    VALUES (NEW.business_id, 'won', now(), now())
    ON CONFLICT (business_id) DO NOTHING;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_won_adds_audience_client ON "sales-pipe".opportunities;
CREATE TRIGGER trg_won_adds_audience_client
    AFTER INSERT OR UPDATE OF stage ON "sales-pipe".opportunities
    FOR EACH ROW WHEN (NEW.stage = 'Won')
    EXECUTE FUNCTION "sales-pipe".trg_won_adds_audience_client();

-- Leads already Won
INSERT INTO "sales-pipe".audience_clients (business_id, source, added_at, updated_at)
SELECT DISTINCT o.business_id, 'won', coalesce(o.closed_at, now()), now()
FROM "sales-pipe".opportunities o
WHERE o.stage = 'Won'
ON CONFLICT (business_id) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
