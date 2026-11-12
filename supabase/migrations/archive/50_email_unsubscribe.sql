-- ==============================================================================
-- 50_email_unsubscribe.sql
-- One-click unsubscribe. Every email carries a signed link to /unsubscribe; when
-- the lead confirms, their address goes on the do-not-contact list (opt_outs),
-- the team is notified, and it is logged. Admins can undo it from Settings.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

ALTER TABLE "sales-pipe".notifications ALTER COLUMN message DROP NOT NULL;
ALTER TABLE "sales-pipe".notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE "sales-pipe".notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('new_reply', 'booking_matched', 'booking_unmatched', 'needs_consultant', 'assigned_to_you', 'upsell_due', 'unsubscribed'));

-- ------------------------------------------------------------------------------
-- 1. record_unsubscribe: called by /unsubscribe after checking the link's
--    signature (service role only). Safe to call twice.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".record_unsubscribe(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v_email text := lower(trim(p_email));
    v_id uuid;
    v_name text;
BEGIN
    IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+$' THEN
        RAISE EXCEPTION 'Not an email address';
    END IF;

    IF EXISTS (SELECT 1 FROM "sales-pipe".opt_outs
               WHERE lower(identifier) = v_email AND lower(channel) IN ('all', 'email')) THEN
        RETURN jsonb_build_object('already', true);
    END IF;

    INSERT INTO "sales-pipe".opt_outs (identifier, channel, reason, source)
    VALUES (v_email, 'Email', 'Unsubscribed using the link in our email', 'unsubscribe')
    RETURNING id INTO v_id;

    SELECT string_agg(DISTINCT b.business_name, ', ') INTO v_name
    FROM "sales-pipe".businesses b WHERE lower(b.email) = v_email;

    -- Tell the admins and whoever owns the lead
    INSERT INTO "sales-pipe".notifications (user_id, type, title, message, link)
    SELECT DISTINCT ON (u.user_id) u.user_id, 'unsubscribed',
           coalesce(v_name, v_email) || ' unsubscribed from emails',
           coalesce(v_name, v_email) || ' unsubscribed from emails',
           coalesce(u.link, '/dashboard/settings#do-not-contact')
    FROM (
        SELECT p.id AS user_id, NULL::text AS link
        FROM "sales-pipe".profiles p WHERE p.role = 'admin' AND p.is_active
        UNION ALL
        SELECT x.user_id, '/dashboard/' || o.id
        FROM "sales-pipe".opportunities o
        JOIN "sales-pipe".businesses b ON b.id = o.business_id
        CROSS JOIN LATERAL (VALUES (o.assigned_sales_id), (o.assigned_consultant_id)) x(user_id)
        WHERE lower(b.email) = v_email AND x.user_id IS NOT NULL
    ) u
    ORDER BY u.user_id, u.link NULLS LAST;

    INSERT INTO "sales-pipe".user_logs (user_name, action, entity_type, entity_id, details)
    VALUES ('Lead', 'unsubscribed', 'opt_out', v_id::text,
            jsonb_build_object('email', v_email, 'business', v_name));

    RETURN jsonb_build_object('already', false);
END;
$$;

REVOKE ALL ON FUNCTION "sales-pipe".record_unsubscribe(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe".record_unsubscribe(text) TO service_role;

-- ------------------------------------------------------------------------------
-- 2. remove_opt_out: admins undo a block (the lead asked to hear from us again).
--    The removed entry is kept in user_logs.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".remove_opt_out(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v_row "sales-pipe".opt_outs;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin']);

    DELETE FROM "sales-pipe".opt_outs WHERE id = p_id RETURNING * INTO v_row;
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'This entry was already removed'; END IF;

    INSERT INTO "sales-pipe".user_logs (user_id, user_name, action, entity_type, entity_id, details)
    SELECT auth.uid()::text, p.full_name, 'removed_opt_out', 'opt_out', v_row.id::text,
           jsonb_build_object('identifier', v_row.identifier, 'channel', v_row.channel,
                              'source', v_row.source, 'reason', v_row.reason, 'blocked_at', v_row.created_at)
    FROM (SELECT 1) one
    LEFT JOIN "sales-pipe".profiles p ON p.id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION "sales-pipe".remove_opt_out(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "sales-pipe".remove_opt_out(uuid) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_opt_outs_identifier_lower ON "sales-pipe".opt_outs (lower(identifier));

COMMIT;
