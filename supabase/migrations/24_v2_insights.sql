-- ==============================================================================
-- 24_v2_insights.sql
-- Numbers for the Insights page, worked out in the database. Safe to re-run.
-- Run after 23.
--
-- Funnel and replies: pitches whose FIRST message was sent in the date range.
-- Wins: pitches won in the date range. Templates: messages sent in the range.
-- Scope: admin sees everyone (or one salesperson), sales see their own,
-- consultants see pitches assigned to them.
-- Phone and Walk-in have no reply messages (outcomes are notes), so the app
-- shows them as "Not tracked" and they are left out of the step numbers.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

CREATE OR REPLACE FUNCTION "sales-pipe".insights(
    p_from date,
    p_to date,
    p_service text DEFAULT NULL,
    p_user uuid DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
    v_role text := "sales-pipe".get_user_role();
    v_uid uuid := auth.uid();
    v_from timestamptz := p_from::timestamptz;
    v_to timestamptz := (p_to + 1)::timestamptz;
    v_result jsonb;
BEGIN
    IF v_role IS NULL THEN RAISE EXCEPTION 'Your account is not set up'; END IF;
    IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN RAISE EXCEPTION 'Pick a valid date range'; END IF;

    WITH scope AS (
        SELECT o.* FROM "sales-pipe".opportunities o
        JOIN "sales-pipe".businesses b ON b.id = o.business_id AND NOT b.archived
        WHERE (nullif(p_service, '') IS NULL OR p_service = ANY(o.services_pitched))
          AND CASE v_role
                WHEN 'admin' THEN (p_user IS NULL OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user)
                WHEN 'sales' THEN o.assigned_sales_id = v_uid
                ELSE o.assigned_consultant_id = v_uid
              END
    ),
    msgs AS (
        SELECT m.*, t.opportunity_id, t.platform
        FROM "sales-pipe".messages m
        JOIN "sales-pipe".threads t ON t.id = m.thread_id
        WHERE t.opportunity_id IN (SELECT id FROM scope)
    ),
    first_out AS (
        SELECT opportunity_id, min(created_at) AS at FROM msgs WHERE direction = 'outbound' GROUP BY opportunity_id
    ),
    cohort AS (
        SELECT s.* FROM scope s JOIN first_out f ON f.opportunity_id = s.id
        WHERE f.at >= v_from AND f.at < v_to
    ),
    reached_stage AS (
        SELECT c.id,
            EXISTS (SELECT 1 FROM msgs m WHERE m.opportunity_id = c.id AND m.direction = 'inbound') AS replied,
            (c.stage IN ('Interested', 'Consultation', 'Won')
             OR EXISTS (SELECT 1 FROM "sales-pipe".stage_changes sc WHERE sc.opportunity_id = c.id AND sc.to_stage IN ('Interested', 'Consultation', 'Won'))) AS interested,
            (c.stage = 'Consultation' OR c.converted_through = 'Consultation'
             OR EXISTS (SELECT 1 FROM "sales-pipe".stage_changes sc WHERE sc.opportunity_id = c.id AND sc.to_stage = 'Consultation')) AS consultation,
            (c.stage = 'Won') AS won
        FROM cohort c
    ),
    -- Threads of the cohort that got at least one message from us
    cohort_threads AS (
        SELECT t.id, t.platform,
            EXISTS (SELECT 1 FROM msgs m WHERE m.thread_id = t.id AND m.direction = 'inbound') AS replied
        FROM "sales-pipe".threads t
        WHERE t.opportunity_id IN (SELECT id FROM cohort)
          AND EXISTS (SELECT 1 FROM msgs m WHERE m.thread_id = t.id AND m.direction = 'outbound')
    ),
    -- For each thread's first reply: which of our messages came just before it
    first_reply AS (
        SELECT DISTINCT ON (m.thread_id) m.thread_id, m.created_at
        FROM msgs m WHERE m.direction = 'inbound' AND m.opportunity_id IN (SELECT id FROM cohort)
        ORDER BY m.thread_id, m.created_at
    ),
    reply_step AS (
        SELECT (SELECT coalesce(o.step_label, 'Other') FROM msgs o
                 WHERE o.thread_id = r.thread_id AND o.direction = 'outbound' AND o.created_at < r.created_at
                 ORDER BY o.created_at DESC LIMIT 1) AS step
        FROM first_reply r
    ),
    step_sent AS (
        SELECT step_label AS step, count(*) AS sent FROM msgs
        WHERE direction = 'outbound' AND opportunity_id IN (SELECT id FROM cohort)
          AND platform NOT IN ('Phone', 'Walk-in')   -- call and visit outcomes are notes, not replies
          AND step_label IN ('First contact', 'Follow-up 1', 'Follow-up 2', 'Final check')
        GROUP BY step_label
    ),
    wins AS (
        SELECT * FROM scope WHERE stage = 'Won' AND won_at >= v_from AND won_at < v_to
    ),
    -- Template use in the range: did they reply before our next message?
    tpl_msgs AS (
        SELECT m.id, m.thread_id, m.template_id, m.created_at,
            EXISTS (
                SELECT 1 FROM msgs i WHERE i.thread_id = m.thread_id AND i.direction = 'inbound' AND i.created_at > m.created_at
                  AND NOT EXISTS (SELECT 1 FROM msgs o2 WHERE o2.thread_id = m.thread_id AND o2.direction = 'outbound'
                                  AND o2.created_at > m.created_at AND o2.created_at < i.created_at)
            ) AS got_reply
        FROM msgs m
        WHERE m.direction = 'outbound' AND m.template_id IS NOT NULL AND m.created_at >= v_from AND m.created_at < v_to
    )
    SELECT jsonb_build_object(
        'totals', (SELECT jsonb_build_object(
            'reached', count(*),
            'replied', count(*) FILTER (WHERE replied),
            'interested', count(*) FILTER (WHERE interested),
            'consultation', count(*) FILTER (WHERE consultation),
            'won', count(*) FILTER (WHERE won)) FROM reached_stage),
        'platforms', coalesce((SELECT jsonb_agg(x ORDER BY x->>'platform') FROM (
            SELECT jsonb_build_object('platform', platform, 'sent', count(*), 'replied', count(*) FILTER (WHERE replied)) AS x
            FROM cohort_threads GROUP BY platform) p), '[]'::jsonb),
        'steps', coalesce((SELECT jsonb_agg(jsonb_build_object('step', s.step, 'sent', s.sent,
                    'replied', (SELECT count(*) FROM reply_step r WHERE r.step = s.step))
                  ORDER BY array_position(ARRAY['First contact', 'Follow-up 1', 'Follow-up 2', 'Final check'], s.step))
                  FROM step_sent s), '[]'::jsonb),
        'wins', jsonb_build_object(
            'total', (SELECT count(*) FROM wins),
            'conversion', coalesce((SELECT jsonb_object_agg(k, n) FROM (SELECT coalesce(conversion_type, 'Not recorded') k, count(*) n FROM wins GROUP BY 1) a), '{}'::jsonb),
            'through', coalesce((SELECT jsonb_object_agg(k, n) FROM (SELECT coalesce(converted_through, 'Not recorded') k, count(*) n FROM wins GROUP BY 1) a), '{}'::jsonb)),
        'templates', coalesce((SELECT jsonb_agg(x ORDER BY (x->>'replied')::numeric / greatest((x->>'sent')::numeric, 1) DESC, (x->>'sent')::int DESC) FROM (
            SELECT jsonb_build_object('name', t.name, 'platform', t.platform, 'step', t.step,
                                      'sent', count(*), 'replied', count(*) FILTER (WHERE got_reply)) AS x
            FROM tpl_msgs m JOIN "sales-pipe".templates t ON t.id = m.template_id
            GROUP BY t.id, t.name, t.platform, t.step) q), '[]'::jsonb)
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

REVOKE EXECUTE ON FUNCTION "sales-pipe".insights(date, date, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "sales-pipe".insights(date, date, text, uuid) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_messages_template ON "sales-pipe".messages (template_id) WHERE template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stage_changes_opp ON "sales-pipe".stage_changes (opportunity_id, to_stage);

NOTIFY pgrst, 'reload schema';
