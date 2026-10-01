-- ==============================================================================
-- 22_v2_fixes.sql
-- Fixes found in testing. Safe to re-run.
-- Run after 13, 15, 16, 17, 18, 19, 20, 21.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

-- ------------------------------------------------------------------------------
-- 1. Working-day helper (used by record_outbound). Same as v1, recreated in case
--    this is a fresh project.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".add_working_days(start_date date, days int)
RETURNS date AS $$
DECLARE
    result date := start_date;
    added int := 0;
BEGIN
    WHILE added < days LOOP
        result := result + 1;
        IF extract(dow from result) NOT IN (0, 6) THEN
            added := added + 1;
        END IF;
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ------------------------------------------------------------------------------
-- 2. Role helper. SECURITY DEFINER so it can read profiles without triggering
--    the profiles rules again (this is what caused "infinite recursion").
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".get_user_role()
RETURNS text AS $$
    SELECT role FROM "sales-pipe".profiles WHERE id = auth.uid() AND is_active = true
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

GRANT EXECUTE ON FUNCTION "sales-pipe".get_user_role() TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. Rebuild the rules that looped on themselves
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles manage admin" ON "sales-pipe".profiles;
CREATE POLICY "Profiles manage admin" ON "sales-pipe".profiles FOR ALL
    USING ("sales-pipe".get_user_role() = 'admin')
    WITH CHECK ("sales-pipe".get_user_role() = 'admin');

DROP POLICY IF EXISTS "Opportunities read" ON "sales-pipe".opportunities;
CREATE POLICY "Opportunities read" ON "sales-pipe".opportunities FOR SELECT USING (
    auth.role() = 'authenticated' AND (
        "sales-pipe".get_user_role() = 'admin'
        OR assigned_sales_id = auth.uid()
        OR assigned_consultant_id = auth.uid()
        OR (assigned_sales_id IS NULL AND assigned_consultant_id IS NULL)
    )
);

DROP POLICY IF EXISTS "Opportunities update" ON "sales-pipe".opportunities;
CREATE POLICY "Opportunities update" ON "sales-pipe".opportunities FOR UPDATE USING (
    auth.role() = 'authenticated' AND (
        "sales-pipe".get_user_role() = 'admin'
        OR assigned_sales_id = auth.uid()
        OR assigned_consultant_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Templates write admin" ON "sales-pipe".templates;
CREATE POLICY "Templates write admin" ON "sales-pipe".templates FOR ALL
    USING ("sales-pipe".get_user_role() = 'admin')
    WITH CHECK ("sales-pipe".get_user_role() = 'admin');

DROP POLICY IF EXISTS "Consultation bookings read admin" ON "sales-pipe".consultation_bookings;
CREATE POLICY "Consultation bookings read admin" ON "sales-pipe".consultation_bookings FOR SELECT
    USING ("sales-pipe".get_user_role() = 'admin');

DROP POLICY IF EXISTS "Consultation bookings update admin" ON "sales-pipe".consultation_bookings;
CREATE POLICY "Consultation bookings update admin" ON "sales-pipe".consultation_bookings FOR UPDATE
    USING ("sales-pipe".get_user_role() = 'admin');

-- ------------------------------------------------------------------------------
-- 4. link_booking: pointed at a table that doesn't exist. Admin only.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".link_booking(p_booking_id uuid, p_opportunity_id uuid)
RETURNS void AS $$
DECLARE
    v_booked timestamptz;
BEGIN
    IF coalesce("sales-pipe".get_user_role(), '') <> 'admin' THEN
        RAISE EXCEPTION 'Only admins can link bookings';
    END IF;

    UPDATE "sales-pipe".consultation_bookings
    SET matched_opportunity_id = p_opportunity_id,
        match_status = 'linked_manually'
    WHERE id = p_booking_id
    RETURNING booked_for INTO v_booked;

    UPDATE "sales-pipe".opportunities
    SET stage = 'Consultation',
        consultation_at = v_booked
    WHERE id = p_opportunity_id
      AND stage NOT IN ('Won', 'Do not contact');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

-- ------------------------------------------------------------------------------
-- 5. Due today: used status values that don't exist ('due', 'replied')
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".v_due_today(p_tab text, p_limit int, p_offset int)
RETURNS TABLE (
    thread_id uuid,
    opportunity_id uuid,
    business_name text,
    platform text,
    step int,
    status text
) AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
BEGIN
    RETURN QUERY
    SELECT t.id, o.id, b.business_name, t.platform, t.step, t.status
    FROM "sales-pipe".threads t
    JOIN "sales-pipe".opportunities o ON o.id = t.opportunity_id
    JOIN "sales-pipe".businesses b ON b.id = o.business_id
    WHERE o.stage IN ('Active', 'Interested', 'Consultation')
      AND (v_role = 'admin' OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid)
      AND (
        (p_tab = 'New outreach' AND t.status = 'Not contacted' AND t.next_due_on <= current_date) OR
        (p_tab = 'Follow-ups'   AND t.status = 'Awaiting reply' AND t.next_due_on <= current_date) OR
        (p_tab = 'Replies'      AND t.status = 'Replied' AND t.last_inbound_at > coalesce(t.last_outbound_at, '-infinity')) OR
        (p_tab = 'All' AND (t.next_due_on <= current_date OR t.status = 'Replied'))
      )
    ORDER BY t.next_due_on ASC NULLS LAST, t.last_inbound_at DESC NULLS LAST
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

-- ------------------------------------------------------------------------------
-- 6. Status counts: "Needs reply" counted closed pitches (Won, Declined) too.
--    Now: open pitches where their last message is newer than ours.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".v_dashboard_status_counts(p_user uuid)
RETURNS TABLE (
    needs_reply bigint,
    interested bigint,
    consultation bigint,
    went_cold bigint,
    no_response bigint,
    needs_consultant bigint,
    unmatched_bookings bigint
) AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role FROM "sales-pipe".profiles WHERE id = p_user;

    RETURN QUERY
    WITH mine AS (
        SELECT o.* FROM "sales-pipe".opportunities o
        WHERE v_role = 'admin' OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user
    )
    SELECT
        (SELECT count(DISTINCT m.id) FROM mine m JOIN "sales-pipe".threads t ON t.opportunity_id = m.id
          WHERE m.stage IN ('Active', 'Interested', 'Consultation')
            AND t.status = 'Replied'
            AND t.last_inbound_at > coalesce(t.last_outbound_at, '-infinity')),
        (SELECT count(*) FROM mine WHERE stage = 'Interested'),
        (SELECT count(*) FROM mine WHERE stage = 'Consultation'),
        (SELECT count(*) FROM mine WHERE stage = 'Went cold'),
        (SELECT count(*) FROM mine WHERE stage = 'No response'),
        (CASE WHEN v_role = 'admin' THEN (SELECT count(*) FROM "sales-pipe".opportunities WHERE stage = 'Consultation' AND assigned_consultant_id IS NULL) ELSE 0 END),
        (CASE WHEN v_role = 'admin' THEN (SELECT count(*) FROM "sales-pipe".consultation_bookings WHERE match_status = 'unmatched') ELSE 0 END);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

-- ------------------------------------------------------------------------------
-- 7. Auto-assign: only ever picked one salesperson. Now splits across everyone
--    with spare capacity, least busy first.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".auto_assign_sales(p_opportunity_ids uuid[])
RETURNS void AS $$
DECLARE
    reps uuid[];
    opp_id uuid;
    rep_idx int := 1;
BEGIN
    IF p_opportunity_ids IS NULL OR array_length(p_opportunity_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    SELECT array_agg(id ORDER BY load ASC) INTO reps
    FROM (
        SELECT p.id, count(o.id) AS load, p.capacity
        FROM "sales-pipe".profiles p
        LEFT JOIN "sales-pipe".opportunities o
            ON o.assigned_sales_id = p.id AND o.stage IN ('Active', 'Interested', 'Consultation')
        WHERE p.role = 'sales' AND p.is_active = true
        GROUP BY p.id, p.capacity
        HAVING count(o.id) < coalesce(p.capacity, 150)
    ) x;

    IF reps IS NULL THEN
        -- Nobody with capacity: leave unassigned and tell the admins
        INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
        SELECT id, 'assigned_to_you', 'New pitches approved but no salesperson has capacity. Assign them manually.', '/dashboard/leads'
        FROM "sales-pipe".profiles WHERE role = 'admin' AND is_active = true;
        RETURN;
    END IF;

    FOREACH opp_id IN ARRAY p_opportunity_ids LOOP
        UPDATE "sales-pipe".opportunities SET assigned_sales_id = reps[rep_idx] WHERE id = opp_id;
        rep_idx := rep_idx % array_length(reps, 1) + 1;
    END LOOP;

    -- One notification per salesperson
    INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
    SELECT assigned_sales_id, 'assigned_to_you', count(*) || ' new pitch(es) assigned to you', '/dashboard'
    FROM "sales-pipe".opportunities
    WHERE id = ANY(p_opportunity_ids) AND assigned_sales_id IS NOT NULL
    GROUP BY assigned_sales_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

-- ------------------------------------------------------------------------------
-- 8. Drafts from templates: general templates (no service set) never matched,
--    and {business_name} / {sender_name} were never filled in.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".generate_draft(p_thread_id uuid, p_step text)
RETURNS void AS $$
DECLARE
    v_opp record;
    v_bus record;
    v_thread record;
    v_template record;
    v_sender text;
    v_body text;
    v_subject text;
    v_missing text[] := '{}';
BEGIN
    SELECT * INTO v_thread FROM "sales-pipe".threads WHERE id = p_thread_id;
    SELECT * INTO v_opp FROM "sales-pipe".opportunities WHERE id = v_thread.opportunity_id;
    SELECT * INTO v_bus FROM "sales-pipe".businesses WHERE id = v_opp.business_id;
    SELECT full_name INTO v_sender FROM "sales-pipe".profiles WHERE id = v_opp.assigned_sales_id;

    -- Don't create a second open draft for the same step
    IF EXISTS (SELECT 1 FROM "sales-pipe".drafts WHERE thread_id = p_thread_id AND step_label = p_step AND status IN ('ready', 'needs_data')) THEN
        RETURN;
    END IF;

    -- Best match: service + business type > service > general
    SELECT * INTO v_template
    FROM "sales-pipe".templates
    WHERE is_active = true
      AND platform = v_thread.platform
      AND step = p_step
      AND (v_opp.services_pitched && services OR coalesce(array_length(services, 1), 0) = 0)
    ORDER BY
      CASE WHEN v_bus.business_type = ANY(business_types) THEN 1 ELSE 2 END,
      CASE WHEN v_opp.services_pitched && services THEN 1 ELSE 2 END
    LIMIT 1;

    IF v_template.id IS NULL THEN
        INSERT INTO "sales-pipe".drafts (thread_id, step_label, body, status, due_on, missing_fields)
        VALUES (p_thread_id, p_step, '', 'needs_data', CURRENT_DATE, ARRAY['template']);
        RETURN;
    END IF;

    v_body := v_template.body;
    v_subject := v_template.subject;

    v_body := replace(replace(v_body, '{business_name}', v_bus.business_name), '{business}', v_bus.business_name);
    v_subject := replace(replace(v_subject, '{business_name}', v_bus.business_name), '{business}', v_bus.business_name);

    IF v_body LIKE '%{area}%' THEN
        IF v_bus.area IS NOT NULL THEN v_body := replace(v_body, '{area}', v_bus.area);
        ELSE v_missing := array_append(v_missing, 'area'); END IF;
    END IF;

    IF v_body LIKE '%{contact_name}%' THEN
        IF v_bus.contact_name IS NOT NULL THEN v_body := replace(v_body, '{contact_name}', v_bus.contact_name);
        ELSE v_missing := array_append(v_missing, 'contact_name'); END IF;
    END IF;

    IF v_body LIKE '%{sender_name}%' THEN
        IF v_sender IS NOT NULL THEN v_body := replace(v_body, '{sender_name}', split_part(v_sender, ' ', 1));
        ELSE v_missing := array_append(v_missing, 'sender_name'); END IF;
    END IF;

    INSERT INTO "sales-pipe".drafts (thread_id, step_label, template_id, body, subject, missing_fields, status, due_on)
    VALUES (
        p_thread_id, p_step, v_template.id, v_body, v_subject, v_missing,
        CASE WHEN array_length(v_missing, 1) > 0 THEN 'needs_data' ELSE 'ready' END,
        CURRENT_DATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

-- ------------------------------------------------------------------------------
-- 9. Approve imported leads: WhatsApp only for mobile numbers (07 / +447),
--    landlines get a Phone thread. Assign first, then draft, so the draft can
--    use the salesperson's name.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".approve_import(p_business_ids uuid[])
RETURNS void AS $$
DECLARE
    b record;
    opp record;
    platforms text[];
    p text;
    approved uuid[] := '{}';
    t record;
BEGIN
    FOR b IN SELECT * FROM "sales-pipe".businesses WHERE id = ANY(p_business_ids) LOOP
        FOR opp IN SELECT * FROM "sales-pipe".opportunities WHERE business_id = b.id AND stage = 'Needs review' LOOP
            platforms := '{}';
            IF b.email IS NOT NULL THEN platforms := array_append(platforms, 'Email'); END IF;
            IF coalesce(b.whatsapp_number, '') <> ''
               OR regexp_replace(coalesce(b.phone, ''), '\D', '', 'g') ~ '^(07|447)' THEN
                platforms := array_append(platforms, 'WhatsApp');
            ELSIF b.phone IS NOT NULL THEN
                platforms := array_append(platforms, 'Phone');
            END IF;
            IF b.instagram IS NOT NULL THEN platforms := array_append(platforms, 'Instagram'); END IF;
            IF b.facebook IS NOT NULL THEN platforms := array_append(platforms, 'Facebook'); END IF;
            IF array_length(platforms, 1) IS NULL THEN platforms := ARRAY['Walk-in']; END IF;

            FOREACH p IN ARRAY platforms LOOP
                INSERT INTO "sales-pipe".threads (opportunity_id, platform, status, step, next_due_on)
                VALUES (opp.id, p, 'Not contacted', 0, CURRENT_DATE)
                ON CONFLICT (opportunity_id, platform) DO NOTHING;
            END LOOP;

            UPDATE "sales-pipe".opportunities SET stage = 'Active' WHERE id = opp.id;
            INSERT INTO "sales-pipe".stage_changes (opportunity_id, from_stage, to_stage, reason, changed_by)
            VALUES (opp.id, 'Needs review', 'Active', 'Approved from review queue', auth.uid());
            approved := array_append(approved, opp.id);
        END LOOP;
    END LOOP;

    PERFORM "sales-pipe".auto_assign_sales(
        ARRAY(SELECT id FROM "sales-pipe".opportunities WHERE id = ANY(approved) AND assigned_sales_id IS NULL)
    );

    FOR t IN SELECT id FROM "sales-pipe".threads WHERE opportunity_id = ANY(approved) AND status = 'Not contacted' LOOP
        PERFORM "sales-pipe".generate_draft(t.id, 'First contact');
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

-- ------------------------------------------------------------------------------
-- 10b. Record a sent message: checks the thread exists and the caller may use it,
--      and uses the follow-up timings from Settings (cadence_rules).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".record_outbound(
    p_thread_id uuid,
    p_body text,
    p_subject text,
    p_template_id uuid,
    p_send_method text,
    p_external_message_id text,
    p_sent_by uuid
) RETURNS void AS $$
DECLARE
    v_thread record;
    v_opp record;
    v_new_step int;
    v_days int;
    v_role text := "sales-pipe".get_user_role();
BEGIN
    SELECT * INTO v_thread FROM "sales-pipe".threads WHERE id = p_thread_id;
    IF v_thread.id IS NULL THEN
        RAISE EXCEPTION 'Thread not found';
    END IF;
    SELECT * INTO v_opp FROM "sales-pipe".opportunities WHERE id = v_thread.opportunity_id;

    -- n8n (service key) is always allowed; people must be admin or assigned
    PERFORM "sales-pipe".check_opp_access(v_opp.id);

    v_new_step := least(v_thread.step + 1, 4);
    SELECT days_delay INTO v_days FROM "sales-pipe".cadence_rules
    WHERE step_name = CASE v_new_step WHEN 1 THEN 'Follow up 1' WHEN 2 THEN 'Follow up 2' WHEN 3 THEN 'Follow up 3' END;
    IF v_new_step < 4 THEN
        v_days := coalesce(v_days, CASE v_new_step WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 14 END);
    ELSE
        v_days := NULL;
    END IF;

    INSERT INTO "sales-pipe".messages (
        thread_id, direction, body, subject, template_id, step_label, send_method, external_message_id, sent_by, delivery_status
    ) VALUES (
        p_thread_id, 'outbound', p_body, p_subject, p_template_id,
        CASE v_thread.step WHEN 0 THEN 'First contact' WHEN 1 THEN 'Follow-up 1' WHEN 2 THEN 'Follow-up 2' ELSE 'Final check' END,
        p_send_method, p_external_message_id, coalesce(p_sent_by, auth.uid()), 'sent'
    );

    UPDATE "sales-pipe".threads
    SET step = v_new_step,
        status = 'Awaiting reply',
        next_due_on = CASE WHEN v_days IS NULL THEN NULL ELSE "sales-pipe".add_working_days(CURRENT_DATE, v_days) END,
        last_outbound_at = now()
    WHERE id = p_thread_id;

    UPDATE "sales-pipe".drafts SET status = 'sent'
    WHERE thread_id = p_thread_id AND status IN ('ready', 'needs_data');

    IF v_opp.stage = 'Needs review' THEN
        UPDATE "sales-pipe".opportunities SET stage = 'Active' WHERE id = v_opp.id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

-- ------------------------------------------------------------------------------
-- 10c. Website bookings: the match used MAX() on ids (not allowed, so every
--      booking insert failed) and never normalised the booking's phone/email.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".trg_match_booking()
RETURNS trigger AS $$
DECLARE
    v_ids uuid[];
    v_opp record;
BEGIN
    NEW.phone_normalised := "sales-pipe".normalise_phone(NEW.phone);
    NEW.email_normalised := "sales-pipe".normalise_email(NEW.email);

    SELECT array_agg(o.id) INTO v_ids
    FROM "sales-pipe".opportunities o
    JOIN "sales-pipe".businesses b ON o.business_id = b.id
    WHERE o.stage IN ('Needs review', 'Active', 'Interested', 'Went cold', 'No response')
      AND (
        (NEW.phone_normalised IS NOT NULL AND b.phone_normalised = NEW.phone_normalised) OR
        (NEW.email_normalised IS NOT NULL AND b.email_normalised = NEW.email_normalised)
      );

    IF coalesce(array_length(v_ids, 1), 0) = 1 THEN
        SELECT * INTO v_opp FROM "sales-pipe".opportunities WHERE id = v_ids[1];
        NEW.match_status := 'matched';
        NEW.matched_opportunity_id := v_opp.id;

        UPDATE "sales-pipe".opportunities
        SET stage = 'Consultation', consultation_at = NEW.booked_for
        WHERE id = v_opp.id;

        INSERT INTO "sales-pipe".stage_changes (opportunity_id, from_stage, to_stage, reason)
        VALUES (v_opp.id, v_opp.stage, 'Consultation', 'Booked a consultation on the website');

        INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
        SELECT id, 'needs_consultant', 'Consultation booked. Assign a consultant.', '/dashboard/' || v_opp.id
        FROM "sales-pipe".profiles WHERE role = 'admin' AND is_active = true;

        IF v_opp.assigned_sales_id IS NOT NULL THEN
            INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
            VALUES (v_opp.assigned_sales_id, 'booking_matched', 'One of your businesses booked a consultation', '/dashboard/' || v_opp.id);
        END IF;
    ELSE
        NEW.match_status := 'unmatched';
        INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
        SELECT id, 'booking_unmatched', 'New booking from ' || NEW.business_name || ' needs linking', '/dashboard'
        FROM "sales-pipe".profiles WHERE role = 'admin' AND is_active = true;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

DROP TRIGGER IF EXISTS trg_booking_match ON "sales-pipe".consultation_bookings;
CREATE TRIGGER trg_booking_match
    BEFORE INSERT ON "sales-pipe".consultation_bookings
    FOR EACH ROW EXECUTE FUNCTION "sales-pipe".trg_match_booking();

-- ------------------------------------------------------------------------------
-- 10. Starter templates (replaces the broken insert at the end of file 19).
--     Website: for cafés, salons, barbers. General: every other service.
--     Placeholders: {business_name}, {sender_name}, {area}, {contact_name}
-- ------------------------------------------------------------------------------
INSERT INTO "sales-pipe".templates (name, platform, step, services, subject, body)
SELECT v.name, v.platform, v.step, v.services, v.subject, v.body
FROM (VALUES
  -- Website
  ('Website · WhatsApp · First contact', 'WhatsApp', 'First contact', ARRAY['Website'], NULL,
   'Hi, I''m {sender_name} from Selfera. I came across {business_name} and loved your reviews. I noticed you don''t have a website yet, so I made a free demo for you. Can I send you the link?'),
  ('Website · WhatsApp · Follow-up 1', 'WhatsApp', 'Follow-up 1', ARRAY['Website'], NULL,
   'Hi again, just checking you saw my message about the free website demo for {business_name}. Happy to send it over.'),
  ('Website · WhatsApp · Follow-up 2', 'WhatsApp', 'Follow-up 2', ARRAY['Website'], NULL,
   'Quick nudge from me. The demo for {business_name} is ready whenever you want a look. No pressure at all.'),
  ('Website · WhatsApp · Final check', 'WhatsApp', 'Final check', ARRAY['Website'], NULL,
   'I''ll leave it here. If you ever want the website demo, just message me. All the best with {business_name}.'),
  ('Website · Instagram · First contact', 'Instagram', 'First contact', ARRAY['Website'], NULL,
   'Hi {business_name} team, I''m {sender_name} from Selfera. I made a free website demo for you. Would you like to see it?'),
  ('Website · Instagram · Follow-up 1', 'Instagram', 'Follow-up 1', ARRAY['Website'], NULL,
   'Hi again, just checking you saw my message about the free website demo. Happy to send it over.'),
  ('Website · Instagram · Follow-up 2', 'Instagram', 'Follow-up 2', ARRAY['Website'], NULL,
   'Quick nudge from me. The demo is ready whenever you want a look.'),
  ('Website · Instagram · Final check', 'Instagram', 'Final check', ARRAY['Website'], NULL,
   'I''ll leave it here. If you ever want the demo, just send me a message.'),
  ('Website · Facebook · First contact', 'Facebook', 'First contact', ARRAY['Website'], NULL,
   'Hi {business_name}, I''m {sender_name} from Selfera. I made a free website demo for you. Would you like to see it?'),
  ('Website · Facebook · Follow-up 1', 'Facebook', 'Follow-up 1', ARRAY['Website'], NULL,
   'Hi again, just checking you saw my message about the free website demo.'),
  ('Website · Facebook · Follow-up 2', 'Facebook', 'Follow-up 2', ARRAY['Website'], NULL,
   'Quick nudge from me. The demo is ready whenever you want a look.'),
  ('Website · Facebook · Final check', 'Facebook', 'Final check', ARRAY['Website'], NULL,
   'I''ll leave it here. If you ever want the demo, just send me a message.'),
  ('Website · Email · First contact', 'Email', 'First contact', ARRAY['Website'], 'A free website demo for {business_name}',
   E'Hi {business_name} team,\n\nI''m {sender_name} from Selfera. I noticed you don''t have a website yet, so I made a free demo for you. Would you like me to send the link?\n\n{sender_name}\nSelfera\nReply STOP and I won''t contact you again.'),
  ('Website · Email · Follow-up 1', 'Email', 'Follow-up 1', ARRAY['Website'], 'Re: A free website demo for {business_name}',
   E'Hi again,\n\nJust checking you saw my email about the free website demo for {business_name}. Happy to send it over.\n\n{sender_name}\nSelfera\nReply STOP and I won''t contact you again.'),
  ('Website · Email · Follow-up 2', 'Email', 'Follow-up 2', ARRAY['Website'], 'Re: A free website demo for {business_name}',
   E'Hi,\n\nA quick nudge from me. The demo is ready whenever you want a look.\n\n{sender_name}\nSelfera\nReply STOP and I won''t contact you again.'),
  ('Website · Email · Final check', 'Email', 'Final check', ARRAY['Website'], 'Re: A free website demo for {business_name}',
   E'Hi,\n\nI''ll leave it here. If you ever want the demo, just reply to this email.\n\n{sender_name}\nSelfera\nReply STOP and I won''t contact you again.'),

  -- General (Micro Automation, End-to-End Automation, Custom Dashboard, Cold Outreach)
  ('General · WhatsApp · First contact', 'WhatsApp', 'First contact', ARRAY[]::text[], NULL,
   'Hi, I''m {sender_name} from Selfera. We help businesses like {business_name} save time by automating bookings, guest messages and follow-ups. Would a quick example be useful?'),
  ('General · WhatsApp · Follow-up 1', 'WhatsApp', 'Follow-up 1', ARRAY[]::text[], NULL,
   'Hi again, just checking you saw my message. Happy to share a short example for {business_name}.'),
  ('General · WhatsApp · Follow-up 2', 'WhatsApp', 'Follow-up 2', ARRAY[]::text[], NULL,
   'Quick nudge from me. Happy to show you in 10 minutes whenever suits.'),
  ('General · WhatsApp · Final check', 'WhatsApp', 'Final check', ARRAY[]::text[], NULL,
   'I''ll leave it here. If it''s ever useful, just message me.'),
  ('General · Instagram · First contact', 'Instagram', 'First contact', ARRAY[]::text[], NULL,
   'Hi {business_name} team, I''m {sender_name} from Selfera. We automate bookings and guest messages for businesses like yours. Would a quick example help?'),
  ('General · Instagram · Follow-up 1', 'Instagram', 'Follow-up 1', ARRAY[]::text[], NULL,
   'Hi again, just checking you saw my message. Happy to share an example.'),
  ('General · Instagram · Follow-up 2', 'Instagram', 'Follow-up 2', ARRAY[]::text[], NULL,
   'Quick nudge from me. Happy to show you whenever suits.'),
  ('General · Instagram · Final check', 'Instagram', 'Final check', ARRAY[]::text[], NULL,
   'I''ll leave it here. If it''s ever useful, just send me a message.'),
  ('General · Facebook · First contact', 'Facebook', 'First contact', ARRAY[]::text[], NULL,
   'Hi {business_name}, I''m {sender_name} from Selfera. We automate bookings and guest messages for businesses like yours. Would a quick example help?'),
  ('General · Facebook · Follow-up 1', 'Facebook', 'Follow-up 1', ARRAY[]::text[], NULL,
   'Hi again, just checking you saw my message. Happy to share an example.'),
  ('General · Facebook · Follow-up 2', 'Facebook', 'Follow-up 2', ARRAY[]::text[], NULL,
   'Quick nudge from me. Happy to show you whenever suits.'),
  ('General · Facebook · Final check', 'Facebook', 'Final check', ARRAY[]::text[], NULL,
   'I''ll leave it here. If it''s ever useful, just send me a message.'),
  ('General · Email · First contact', 'Email', 'First contact', ARRAY[]::text[], 'Saving {business_name} time on bookings and guest messages',
   E'Hi {business_name} team,\n\nI''m {sender_name} from Selfera. We help independent businesses automate bookings, guest messages, review requests and reporting, so the team spends less time on admin. Would a short call be useful?\n\n{sender_name}\nSelfera\nReply STOP and I won''t contact you again.'),
  ('General · Email · Follow-up 1', 'Email', 'Follow-up 1', ARRAY[]::text[], 'Re: Saving {business_name} time on bookings and guest messages',
   E'Hi again,\n\nJust checking you saw my note. Happy to share a quick example of what this could look like for {business_name}.\n\n{sender_name}\nSelfera\nReply STOP and I won''t contact you again.'),
  ('General · Email · Follow-up 2', 'Email', 'Follow-up 2', ARRAY[]::text[], 'Re: Saving {business_name} time on bookings and guest messages',
   E'Hi,\n\nA last nudge from me. Happy to show you in 15 minutes whenever suits.\n\n{sender_name}\nSelfera\nReply STOP and I won''t contact you again.'),
  ('General · Email · Final check', 'Email', 'Final check', ARRAY[]::text[], 'Re: Saving {business_name} time on bookings and guest messages',
   E'Hi,\n\nI''ll leave it here. If it''s ever useful, just reply to this email.\n\n{sender_name}\nSelfera\nReply STOP and I won''t contact you again.'),

  -- Phone and walk-in (call notes, any service)
  ('General · Phone · First contact', 'Phone', 'First contact', ARRAY[]::text[], NULL,
   'Call script: Hi, is this {business_name}? I''m {sender_name} from Selfera. Could I speak to the owner or manager for two minutes? (Note the outcome here.)'),
  ('General · Walk-in · First contact', 'Walk-in', 'First contact', ARRAY[]::text[], NULL,
   'Walk-in notes for {business_name}: who you spoke to, what they said, next step.')
) AS v(name, platform, step, services, subject, body)
WHERE NOT EXISTS (SELECT 1 FROM "sales-pipe".templates t WHERE t.name = v.name);


-- ------------------------------------------------------------------------------
-- 12. Access checks for actions on a pitch (admin, or the assigned salesperson
--     or consultant). n8n uses the service key and is always allowed.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".check_opp_access(p_opportunity_id uuid)
RETURNS void AS $$
DECLARE
    v_opp record;
BEGIN
    IF auth.role() = 'service_role' THEN RETURN; END IF;
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not logged in'; END IF;
    IF "sales-pipe".get_user_role() = 'admin' THEN RETURN; END IF;
    SELECT * INTO v_opp FROM "sales-pipe".opportunities WHERE id = p_opportunity_id;
    IF v_opp.id IS NULL THEN RAISE EXCEPTION 'Pitch not found'; END IF;
    IF auth.uid() IS DISTINCT FROM v_opp.assigned_sales_id
       AND auth.uid() IS DISTINCT FROM v_opp.assigned_consultant_id
       AND NOT (v_opp.assigned_sales_id IS NULL AND v_opp.assigned_consultant_id IS NULL) THEN
        RAISE EXCEPTION 'You are not assigned to this business';
    END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

CREATE OR REPLACE FUNCTION "sales-pipe".set_stage(p_opportunity_id uuid, p_stage text, p_reason text, p_user_id uuid)
RETURNS void AS $$
DECLARE
    v_old text;
BEGIN
    PERFORM "sales-pipe".check_opp_access(p_opportunity_id);
    SELECT stage INTO v_old FROM "sales-pipe".opportunities WHERE id = p_opportunity_id;
    IF v_old IS DISTINCT FROM p_stage THEN
        UPDATE "sales-pipe".opportunities
        SET stage = p_stage,
            closed_at = CASE WHEN p_stage IN ('Declined', 'Do not contact', 'No response') THEN now() ELSE closed_at END
        WHERE id = p_opportunity_id;
        IF p_stage = 'Do not contact' THEN
            UPDATE "sales-pipe".threads SET status = 'Opted out', next_due_on = NULL WHERE opportunity_id = p_opportunity_id;
        END IF;
        INSERT INTO "sales-pipe".stage_changes (opportunity_id, from_stage, to_stage, reason, changed_by)
        VALUES (p_opportunity_id, v_old, p_stage, p_reason, coalesce(p_user_id, auth.uid()));
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

CREATE OR REPLACE FUNCTION "sales-pipe".record_win(p_opportunity_id uuid, p_services_won text[], p_converted_through text, p_user_id uuid)
RETURNS void AS $$
DECLARE
    v_opp record;
    v_type text;
BEGIN
    PERFORM "sales-pipe".check_opp_access(p_opportunity_id);
    SELECT * INTO v_opp FROM "sales-pipe".opportunities WHERE id = p_opportunity_id;
    IF p_services_won IS NULL OR array_length(p_services_won, 1) IS NULL THEN
        RAISE EXCEPTION 'Pick at least one service won';
    END IF;
    v_type := CASE
        WHEN v_opp.services_pitched @> p_services_won AND p_services_won @> v_opp.services_pitched THEN 'As pitched'
        WHEN p_services_won @> v_opp.services_pitched THEN 'Expanded'
        WHEN v_opp.services_pitched @> p_services_won THEN 'Narrowed'
        ELSE 'Switched' END;

    UPDATE "sales-pipe".opportunities
    SET stage = 'Won', won_at = now(), closed_at = now(), services_won = p_services_won,
        converted_through = p_converted_through, conversion_type = v_type,
        upsell_reminder_on = CURRENT_DATE + 30
    WHERE id = p_opportunity_id;

    UPDATE "sales-pipe".threads SET next_due_on = NULL WHERE opportunity_id = p_opportunity_id;

    INSERT INTO "sales-pipe".stage_changes (opportunity_id, from_stage, to_stage, from_services, to_services, reason, changed_by)
    VALUES (p_opportunity_id, v_opp.stage, 'Won', v_opp.services_pitched, p_services_won, 'Won (' || v_type || ')', coalesce(p_user_id, auth.uid()));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

CREATE OR REPLACE FUNCTION "sales-pipe".hand_over(p_opportunity_id uuid, p_consultation_at timestamptz, p_user_id uuid)
RETURNS void AS $$
DECLARE
    v_old text;
BEGIN
    PERFORM "sales-pipe".check_opp_access(p_opportunity_id);
    SELECT stage INTO v_old FROM "sales-pipe".opportunities WHERE id = p_opportunity_id;
    UPDATE "sales-pipe".opportunities SET stage = 'Consultation', consultation_at = p_consultation_at WHERE id = p_opportunity_id;
    UPDATE "sales-pipe".threads SET next_due_on = NULL WHERE opportunity_id = p_opportunity_id;
    INSERT INTO "sales-pipe".stage_changes (opportunity_id, from_stage, to_stage, reason, changed_by)
    VALUES (p_opportunity_id, v_old, 'Consultation', 'Handed over', coalesce(p_user_id, auth.uid()));
    INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
    SELECT id, 'needs_consultant', 'Consultation booked. Assign a consultant.', '/dashboard/' || p_opportunity_id
    FROM "sales-pipe".profiles WHERE role = 'admin' AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

-- assign_consultant: admin only, and keep the notifications (file 19 dropped them)
CREATE OR REPLACE FUNCTION "sales-pipe".assign_consultant(p_opportunity_id uuid, p_consultant_id uuid)
RETURNS void AS $$
BEGIN
    IF auth.role() <> 'service_role' AND coalesce("sales-pipe".get_user_role(), '') <> 'admin' THEN
        RAISE EXCEPTION 'Only admins can assign consultants';
    END IF;
    UPDATE "sales-pipe".opportunities SET assigned_consultant_id = p_consultant_id WHERE id = p_opportunity_id;
    INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
    VALUES (p_consultant_id, 'assigned_to_you', 'You have been assigned a consultation', '/dashboard/' || p_opportunity_id);
    INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
    SELECT assigned_sales_id, 'assigned_to_you', 'A consultant was assigned to your business', '/dashboard/' || p_opportunity_id
    FROM "sales-pipe".opportunities WHERE id = p_opportunity_id AND assigned_sales_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

-- ------------------------------------------------------------------------------
-- 13. Inbound messages (called by n8n only): pause only open threads, record
--     the reply time, link the notification to the business.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".record_inbound(
    p_platform text, p_external_thread_id text, p_from text, p_body text,
    p_external_message_id text, p_media_url text
) RETURNS void AS $$
DECLARE
    v_thread_id uuid;
    v_opp_id uuid;
BEGIN
    IF p_external_message_id IS NOT NULL AND EXISTS (SELECT 1 FROM "sales-pipe".messages WHERE external_message_id = p_external_message_id) THEN
        RETURN;
    END IF;

    SELECT id, opportunity_id INTO v_thread_id, v_opp_id
    FROM "sales-pipe".threads
    WHERE p_external_thread_id IS NOT NULL AND external_thread_id = p_external_thread_id AND platform = p_platform
    LIMIT 1;

    IF v_thread_id IS NULL THEN
        SELECT t.id, t.opportunity_id INTO v_thread_id, v_opp_id
        FROM "sales-pipe".threads t
        JOIN "sales-pipe".opportunities o ON t.opportunity_id = o.id
        JOIN "sales-pipe".businesses b ON o.business_id = b.id
        WHERE t.platform = p_platform
          AND o.stage IN ('Active', 'Interested', 'Consultation', 'Went cold', 'No response')
          AND (b.phone_normalised = "sales-pipe".normalise_phone(p_from)
               OR b.email_normalised = "sales-pipe".normalise_email(p_from)
               OR lower(b.instagram) = lower(p_from)
               OR lower(b.facebook) = lower(p_from))
        ORDER BY t.created_at DESC LIMIT 1;
        IF v_thread_id IS NOT NULL AND p_external_thread_id IS NOT NULL THEN
            UPDATE "sales-pipe".threads SET external_thread_id = p_external_thread_id WHERE id = v_thread_id;
        END IF;
    END IF;

    IF v_thread_id IS NULL THEN
        RETURN; -- not one of our leads
    END IF;

    INSERT INTO "sales-pipe".messages (thread_id, direction, body, send_method, external_message_id, media_url)
    VALUES (v_thread_id, 'inbound', p_body, 'webhook', p_external_message_id, p_media_url);

    IF upper(trim(p_body)) IN ('STOP', 'UNSUBSCRIBE', 'STOP.') THEN
        UPDATE "sales-pipe".threads SET status = 'Opted out', next_due_on = NULL, last_inbound_at = now() WHERE opportunity_id = v_opp_id;
        UPDATE "sales-pipe".opportunities SET stage = 'Do not contact', closed_at = now() WHERE id = v_opp_id;
        RETURN;
    END IF;

    UPDATE "sales-pipe".threads
    SET status = 'Replied', next_due_on = NULL, last_inbound_at = now(), paused_reason = NULL
    WHERE id = v_thread_id;

    UPDATE "sales-pipe".threads
    SET status = 'Paused', paused_reason = 'Replied on ' || p_platform, next_due_on = NULL
    WHERE opportunity_id = v_opp_id AND id <> v_thread_id AND status IN ('Not contacted', 'Awaiting reply');

    UPDATE "sales-pipe".drafts SET status = 'discarded'
    WHERE status IN ('ready', 'needs_data')
      AND thread_id IN (SELECT id FROM "sales-pipe".threads WHERE opportunity_id = v_opp_id AND id <> v_thread_id);

    UPDATE "sales-pipe".opportunities SET stage = 'Active'
    WHERE id = v_opp_id AND stage IN ('Went cold', 'No response');

    INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
    SELECT coalesce(o.assigned_consultant_id, o.assigned_sales_id), 'new_reply',
           'New reply from ' || b.business_name || ' on ' || p_platform,
           '/dashboard/' || o.id || '/thread/' || v_thread_id
    FROM "sales-pipe".opportunities o JOIN "sales-pipe".businesses b ON b.id = o.business_id
    WHERE o.id = v_opp_id AND coalesce(o.assigned_consultant_id, o.assigned_sales_id) IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

-- ------------------------------------------------------------------------------
-- 14. Daily update (n8n, 09:00 Mon to Fri). Sends nothing.
--     Fixes: upsell step crashed, and timings now use working days.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".daily_update()
RETURNS void AS $$
DECLARE
    t record;
    o record;
BEGIN
    -- 1. Drafts for threads due today
    FOR t IN
        SELECT th.id, th.step FROM "sales-pipe".threads th
        JOIN "sales-pipe".opportunities op ON op.id = th.opportunity_id
        WHERE th.next_due_on <= CURRENT_DATE AND th.step < 4
          AND th.status IN ('Not contacted', 'Awaiting reply')
          AND op.stage IN ('Active', 'Interested')
    LOOP
        PERFORM "sales-pipe".generate_draft(t.id,
            CASE t.step WHEN 0 THEN 'First contact' WHEN 1 THEN 'Follow-up 1' WHEN 2 THEN 'Follow-up 2' ELSE 'Final check' END);
    END LOOP;

    -- 2. Final check sent 14+ working days ago, no reply
    UPDATE "sales-pipe".threads
    SET status = 'No reply', next_due_on = NULL
    WHERE step = 4 AND status = 'Awaiting reply'
      AND "sales-pipe".add_working_days(last_outbound_at::date, 14) <= CURRENT_DATE;

    -- 3. Every contacted thread is No reply and they never replied: No response
    UPDATE "sales-pipe".opportunities op
    SET stage = 'No response', closed_at = now()
    WHERE op.stage = 'Active'
      AND EXISTS (SELECT 1 FROM "sales-pipe".threads th WHERE th.opportunity_id = op.id AND th.step > 0)
      AND NOT EXISTS (SELECT 1 FROM "sales-pipe".threads th WHERE th.opportunity_id = op.id AND th.step > 0 AND th.status <> 'No reply')
      AND NOT EXISTS (SELECT 1 FROM "sales-pipe".threads th WHERE th.opportunity_id = op.id AND th.last_inbound_at IS NOT NULL);

    -- 4. They replied once, we sent 2+ since, latest 5+ working days old: Went cold
    UPDATE "sales-pipe".opportunities op
    SET stage = 'Went cold'
    WHERE op.stage IN ('Active', 'Interested')
      AND EXISTS (
          SELECT 1 FROM "sales-pipe".threads th
          WHERE th.opportunity_id = op.id AND th.last_inbound_at IS NOT NULL
            AND th.last_outbound_at > th.last_inbound_at
            AND "sales-pipe".add_working_days(th.last_outbound_at::date, 5) <= CURRENT_DATE
            AND (SELECT count(*) FROM "sales-pipe".messages m
                 WHERE m.thread_id = th.id AND m.direction = 'outbound' AND m.created_at > th.last_inbound_at) >= 2);

    -- 5. Upsell reminders (once)
    FOR o IN
        SELECT op.id, op.assigned_sales_id, b.business_name
        FROM "sales-pipe".opportunities op JOIN "sales-pipe".businesses b ON b.id = op.business_id
        WHERE op.stage = 'Won' AND op.upsell_reminder_on <= CURRENT_DATE
    LOOP
        IF o.assigned_sales_id IS NOT NULL THEN
            INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
            VALUES (o.assigned_sales_id, 'upsell_due', 'Upsell due for ' || o.business_name, '/dashboard/' || o.id);
        END IF;
        UPDATE "sales-pipe".opportunities SET upsell_reminder_on = NULL WHERE id = o.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

-- ------------------------------------------------------------------------------
-- 15. Who can call what. Postgres lets everyone run functions by default, and
--     file 01 granted them to anon. Lock that down.
-- ------------------------------------------------------------------------------
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA "sales-pipe" FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "sales-pipe" TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA "sales-pipe" REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

-- n8n-only functions
REVOKE EXECUTE ON FUNCTION "sales-pipe".record_inbound(text, text, text, text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION "sales-pipe".daily_update() FROM authenticated;

-- ------------------------------------------------------------------------------
-- 16. Tell the API about the changes
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
