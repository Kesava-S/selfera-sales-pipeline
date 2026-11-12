-- ==============================================================================
-- 65_delete_leads_everywhere.sql
-- Delete leads (businesses) from Lead Management and everything connected to them,
-- in one transaction. Admin only (like archive).
--
-- Removed:
--   * the business, its pitches, conversations, messages, drafts, notes, stage
--     history and tasks (database cascade)
--   * its Client Audience: customers, imports, settings, client campaigns (cascade)
--   * campaign recipients and campaign replies for the lead
--   * consultation bookings matched to its pitches
--   * the lead in saved email / WhatsApp contact lists and in draft campaigns' lists
--   * notifications and activity log lines that point at it
-- Kept on purpose:
--   * opt-outs (email / phone only): UK PECR, so a re-imported contact is never
--     messaged again
-- One log line records the delete (counts only, no personal details).
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

-- Contacts / recipients are a JSON array, sometimes stored as a JSON string
CREATE OR REPLACE FUNCTION "sales-pipe".jsonb_list(p jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE jsonb_typeof(p)
        WHEN 'array' THEN p
        WHEN 'string' THEN coalesce((p #>> '{}')::jsonb, '[]'::jsonb)
        ELSE '[]'::jsonb
    END
$$;

CREATE OR REPLACE FUNCTION "sales-pipe".delete_leads_everywhere(p_business_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v_ids uuid[];
    v_opps uuid[];
    v_id_text text[];
    v_messages int := 0;
    v_recipients int := 0;
    v_replies int := 0;
    v_bookings int := 0;
    v_lists int := 0;
    v_customers int := 0;
    v_deleted int := 0;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin']);

    SELECT array_agg(id) INTO v_ids FROM "sales-pipe".businesses WHERE id = ANY(p_business_ids);
    IF v_ids IS NULL THEN
        RETURN jsonb_build_object('deleted', 0);
    END IF;
    SELECT coalesce(array_agg(id), '{}') INTO v_opps FROM "sales-pipe".opportunities WHERE business_id = ANY(v_ids);
    v_id_text := ARRAY(SELECT unnest(v_ids)::text UNION ALL SELECT unnest(v_opps)::text);

    SELECT count(*) INTO v_messages FROM "sales-pipe".messages m
        JOIN "sales-pipe".threads t ON t.id = m.thread_id WHERE t.opportunity_id = ANY(v_opps);
    SELECT count(*) INTO v_customers FROM "sales-pipe".customer_leads WHERE business_id = ANY(v_ids);

    -- Pitches started from one of these (upsell) keep going, just without the link
    UPDATE "sales-pipe".opportunities SET source_opportunity_id = NULL
        WHERE source_opportunity_id = ANY(v_opps) AND NOT (business_id = ANY(v_ids));

    -- Campaign replies and recipients for the lead
    DELETE FROM "sales-pipe".campaign_replies
        WHERE business_id = ANY(v_ids) OR opportunity_id = ANY(v_opps);
    GET DIAGNOSTICS v_replies = ROW_COUNT;
    DELETE FROM "sales-pipe".campaign_recipients WHERE business_id = ANY(v_ids);
    GET DIAGNOSTICS v_recipients = ROW_COUNT;

    -- Bookings matched to its pitches
    DELETE FROM "sales-pipe".consultation_bookings WHERE matched_opportunity_id = ANY(v_opps);
    GET DIAGNOSTICS v_bookings = ROW_COUNT;

    -- Saved contact lists and campaign lists hold copies of the lead (matched by its id)
    WITH changed AS (
        UPDATE "sales-pipe".email_databases d SET
            contacts = coalesce((SELECT jsonb_agg(e) FROM jsonb_array_elements("sales-pipe".jsonb_list(d.contacts)) e
                                 WHERE NOT (e ->> 'id' = ANY(v_id_text))), '[]'::jsonb),
            contact_count = (SELECT count(*) FROM jsonb_array_elements("sales-pipe".jsonb_list(d.contacts)) e
                             WHERE NOT (e ->> 'id' = ANY(v_id_text)))
        WHERE EXISTS (SELECT 1 FROM jsonb_array_elements("sales-pipe".jsonb_list(d.contacts)) e WHERE e ->> 'id' = ANY(v_id_text))
        RETURNING 1
    ) SELECT v_lists + count(*) INTO v_lists FROM changed;
    WITH changed AS (
        UPDATE "sales-pipe".whatsapp_databases d SET
            contacts = coalesce((SELECT jsonb_agg(e) FROM jsonb_array_elements("sales-pipe".jsonb_list(d.contacts)) e
                                 WHERE NOT (e ->> 'id' = ANY(v_id_text))), '[]'::jsonb),
            contact_count = (SELECT count(*) FROM jsonb_array_elements("sales-pipe".jsonb_list(d.contacts)) e
                             WHERE NOT (e ->> 'id' = ANY(v_id_text)))
        WHERE EXISTS (SELECT 1 FROM jsonb_array_elements("sales-pipe".jsonb_list(d.contacts)) e WHERE e ->> 'id' = ANY(v_id_text))
        RETURNING 1
    ) SELECT v_lists + count(*) INTO v_lists FROM changed;
    UPDATE "sales-pipe".email_campaigns c SET
        recipients = coalesce((SELECT jsonb_agg(e) FROM jsonb_array_elements("sales-pipe".jsonb_list(c.recipients)) e
                               WHERE NOT (e ->> 'id' = ANY(v_id_text))), '[]'::jsonb)
    WHERE EXISTS (SELECT 1 FROM jsonb_array_elements("sales-pipe".jsonb_list(c.recipients)) e WHERE e ->> 'id' = ANY(v_id_text));
    UPDATE "sales-pipe".whatsapp_campaigns c SET
        recipients = coalesce((SELECT jsonb_agg(e) FROM jsonb_array_elements("sales-pipe".jsonb_list(c.recipients)) e
                               WHERE NOT (e ->> 'id' = ANY(v_id_text))), '[]'::jsonb)
    WHERE EXISTS (SELECT 1 FROM jsonb_array_elements("sales-pipe".jsonb_list(c.recipients)) e WHERE e ->> 'id' = ANY(v_id_text));

    -- Notifications and activity log lines that point at the lead
    DELETE FROM "sales-pipe".notifications n
        WHERE EXISTS (SELECT 1 FROM unnest(v_id_text) x WHERE n.link LIKE '%' || x || '%');
    DELETE FROM "sales-pipe".user_logs WHERE entity_id = ANY(v_id_text);

    -- The business: pitches, threads, messages, drafts, notes, stage history, tasks
    -- and its Client Audience go with it (database cascade)
    DELETE FROM "sales-pipe".businesses WHERE id = ANY(v_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    -- One line for the record: counts only, no personal details
    INSERT INTO "sales-pipe".user_logs (user_id, user_name, action, entity_type, entity_id, details)
    SELECT auth.uid()::text, p.full_name, 'leads_deleted', 'business', NULL,
           jsonb_build_object('leads', v_deleted, 'pitches', cardinality(v_opps), 'messages', v_messages,
                              'campaign_recipients', v_recipients, 'campaign_replies', v_replies,
                              'bookings', v_bookings, 'contact_lists', v_lists, 'audience_customers', v_customers)
    FROM (SELECT 1) one LEFT JOIN "sales-pipe".profiles p ON p.id = auth.uid();

    RETURN jsonb_build_object(
        'deleted', v_deleted, 'pitches', cardinality(v_opps), 'messages', v_messages,
        'campaign_recipients', v_recipients, 'campaign_replies', v_replies, 'bookings', v_bookings,
        'contact_lists', v_lists, 'audience_customers', v_customers
    );
END;
$$;

REVOKE ALL ON FUNCTION "sales-pipe".delete_leads_everywhere(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "sales-pipe".delete_leads_everywhere(uuid[]) TO authenticated, service_role;
REVOKE ALL ON FUNCTION "sales-pipe".jsonb_list(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "sales-pipe".jsonb_list(jsonb) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
