-- ==============================================================================
-- 70_whatsapp_stop_do_not_contact.sql
-- A WhatsApp reply of STOP / UNSUBSCRIBE / OPT OUT puts the number on the
-- do-not-contact list (opt_outs, channel 'WhatsApp', source 'inbound'), the same
-- way email unsubscribes do. Campaigns already skip numbers on the list; the
-- chat send route checks it too (app code).
--
-- * Leads and unknown numbers: added to the list.
-- * Client Audience customers replying to a client's campaign: not added here
--   (that opt-out is per client and handled by capture_campaign_reply).
-- * Existing STOP replies already in Lead Management chats are added once.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

CREATE OR REPLACE FUNCTION "sales-pipe".is_stop_reply(p_body text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT upper(regexp_replace(trim(coalesce(p_body, '')), '[.!]+$', '')) IN ('STOP', 'UNSUBSCRIBE', 'OPT OUT', 'OPT-OUT', 'OPTOUT')
$$;

CREATE OR REPLACE FUNCTION "sales-pipe".record_whatsapp_opt_out(p_from text, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v_phone text := "sales-pipe".normalise_phone(p_from);
    v_digits text := regexp_replace(coalesce(p_from, ''), '\D', '', 'g');
    v_id uuid;
    v_name text;
BEGIN
    IF NOT "sales-pipe".is_stop_reply(p_body) THEN
        RETURN jsonb_build_object('stop', false);
    END IF;
    IF length(v_digits) < 7 THEN
        RETURN jsonb_build_object('stop', true, 'skipped', 'no number');
    END IF;

    -- A Client Audience customer answering a client's campaign: per-client opt-out only
    IF EXISTS (
        SELECT 1 FROM (
            SELECT r.customer_lead_id FROM "sales-pipe".campaign_recipients r
            WHERE r.channel = 'whatsapp' AND r.status = 'sent' AND r.sent_at > now() - interval '30 days'
              AND "sales-pipe".normalise_phone(r.phone) = v_phone
            ORDER BY r.sent_at DESC LIMIT 1
        ) last WHERE last.customer_lead_id IS NOT NULL
    ) THEN
        RETURN jsonb_build_object('stop', true, 'skipped', 'client audience');
    END IF;

    IF EXISTS (SELECT 1 FROM "sales-pipe".opt_outs
               WHERE regexp_replace(identifier, '\D', '', 'g') = v_digits AND lower(channel) IN ('all', 'whatsapp')) THEN
        RETURN jsonb_build_object('stop', true, 'already', true);
    END IF;

    INSERT INTO "sales-pipe".opt_outs (identifier, channel, reason, source)
    VALUES (v_phone, 'WhatsApp', 'Replied "' || left(trim(p_body), 40) || '" on WhatsApp', 'inbound')
    RETURNING id INTO v_id;

    SELECT string_agg(DISTINCT b.business_name, ', ') INTO v_name
    FROM "sales-pipe".businesses b
    WHERE "sales-pipe".normalise_phone(b.whatsapp_number) = v_phone OR b.phone_normalised = v_phone;

    -- Tell the admins and whoever owns the lead
    INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
    SELECT DISTINCT ON (u.user_id) u.user_id, 'unsubscribed',
           coalesce(v_name, v_phone) || ' opted out of WhatsApp',
           coalesce(u.link, '/dashboard/settings#do-not-contact')
    FROM (
        SELECT p.id AS user_id, NULL::text AS link
        FROM "sales-pipe".profiles p WHERE p.role = 'admin' AND p.is_active
        UNION ALL
        SELECT x.user_id, '/dashboard/' || o.id
        FROM "sales-pipe".opportunities o
        JOIN "sales-pipe".businesses b ON b.id = o.business_id
        CROSS JOIN LATERAL (VALUES (o.assigned_sales_id), (o.assigned_consultant_id)) x(user_id)
        WHERE ("sales-pipe".normalise_phone(b.whatsapp_number) = v_phone OR b.phone_normalised = v_phone)
          AND x.user_id IS NOT NULL
    ) u
    ORDER BY u.user_id, u.link NULLS LAST;

    INSERT INTO "sales-pipe".user_logs (user_name, action, entity_type, entity_id, details)
    VALUES ('Lead', 'opted_out', 'opt_out', v_id::text,
            jsonb_build_object('channel', 'WhatsApp', 'business', v_name));

    RETURN jsonb_build_object('stop', true, 'already', false);
END;
$$;

REVOKE ALL ON FUNCTION "sales-pipe".record_whatsapp_opt_out(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe".record_whatsapp_opt_out(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe".is_stop_reply(text) TO authenticated, service_role;

-- Earlier STOP replies in Lead Management WhatsApp chats (no notifications for these)
INSERT INTO "sales-pipe".opt_outs (identifier, channel, reason, source, created_at)
SELECT DISTINCT ON (regexp_replace(ph.phone, '\D', '', 'g'))
       ph.phone, 'WhatsApp', 'Replied "' || left(trim(m.body), 40) || '" on WhatsApp', 'inbound', m.created_at
FROM "sales-pipe".messages m
JOIN "sales-pipe".threads t ON t.id = m.thread_id AND t.platform = 'WhatsApp'
JOIN "sales-pipe".opportunities o ON o.id = t.opportunity_id
JOIN "sales-pipe".businesses b ON b.id = o.business_id
CROSS JOIN LATERAL (SELECT "sales-pipe".normalise_phone(b.whatsapp_number) AS phone) ph
WHERE m.direction = 'inbound' AND "sales-pipe".is_stop_reply(m.body)
  AND length(regexp_replace(coalesce(ph.phone, ''), '\D', '', 'g')) >= 7
  AND NOT EXISTS (SELECT 1 FROM "sales-pipe".opt_outs x
                  WHERE regexp_replace(x.identifier, '\D', '', 'g') = regexp_replace(ph.phone, '\D', '', 'g')
                    AND lower(x.channel) IN ('all', 'whatsapp'))
ORDER BY regexp_replace(ph.phone, '\D', '', 'g'), m.created_at;

COMMIT;

NOTIFY pgrst, 'reload schema';
