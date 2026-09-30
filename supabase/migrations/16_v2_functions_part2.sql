-- ==============================================================================
-- 16_v2_functions_part2.sql
-- Core business logic functions (Part 2)
-- ==============================================================================

SET search_path TO "sales-pipe", public;

-- ==============================================================================
-- OUTBOUND & INBOUND
-- ==============================================================================

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
    v_next_due date;
BEGIN
    SELECT * INTO v_thread FROM "sales-pipe".threads WHERE id = p_thread_id;
    SELECT * INTO v_opp FROM "sales-pipe".opportunities WHERE id = v_thread.opportunity_id;

    -- Calculate next step
    v_new_step := v_thread.step + 1;
    IF v_new_step > 4 THEN v_new_step := 4; END IF;

    -- Calculate next due on (working days logic - assuming add_working_days exists)
    -- Cadence: step 1 -> +3, step 2 -> +5, step 3 -> +14
    IF v_new_step = 1 THEN
        v_next_due := "sales-pipe".add_working_days(CURRENT_DATE, 3);
    ELSIF v_new_step = 2 THEN
        v_next_due := "sales-pipe".add_working_days(CURRENT_DATE, 5);
    ELSIF v_new_step = 3 THEN
        v_next_due := "sales-pipe".add_working_days(CURRENT_DATE, 14);
    ELSE
        v_next_due := NULL; -- Final check has no outbound due after it
    END IF;

    -- Insert message
    INSERT INTO "sales-pipe".messages (
        thread_id, direction, body, subject, template_id, send_method, external_message_id, sent_by, delivery_status
    ) VALUES (
        p_thread_id, 'outbound', p_body, p_subject, p_template_id, p_send_method, p_external_message_id, p_sent_by, 'sent'
    );

    -- Update thread
    UPDATE "sales-pipe".threads
    SET step = v_new_step,
        status = 'Awaiting reply',
        next_due_on = v_next_due,
        last_outbound_at = now()
    WHERE id = p_thread_id;

    -- Update draft status to sent
    UPDATE "sales-pipe".drafts
    SET status = 'sent'
    WHERE thread_id = p_thread_id AND status IN ('ready', 'needs_data');

    -- Update Opportunity stage if Needs review
    IF v_opp.stage = 'Needs review' THEN
        UPDATE "sales-pipe".opportunities SET stage = 'Active' WHERE id = v_opp.id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION "sales-pipe".record_inbound(
    p_platform text,
    p_external_thread_id text,
    p_from text,
    p_body text,
    p_external_message_id text,
    p_media_url text
) RETURNS void AS $$
DECLARE
    v_thread_id uuid;
    v_opp_id uuid;
    v_is_stop boolean := false;
BEGIN
    -- Ignore duplicates
    IF EXISTS (SELECT 1 FROM "sales-pipe".messages WHERE external_message_id = p_external_message_id) THEN
        RETURN;
    END IF;

    -- Find thread
    SELECT id, opportunity_id INTO v_thread_id, v_opp_id
    FROM "sales-pipe".threads
    WHERE external_thread_id = p_external_thread_id AND platform = p_platform
    LIMIT 1;

    -- If not found by external ID, try matching business contact info
    IF v_thread_id IS NULL THEN
        -- Basic logic: try to find opportunity by normalised phone or email
        SELECT t.id, t.opportunity_id INTO v_thread_id, v_opp_id
        FROM "sales-pipe".threads t
        JOIN "sales-pipe".opportunities o ON t.opportunity_id = o.id
        JOIN "sales-pipe".businesses b ON o.business_id = b.id
        WHERE t.platform = p_platform
          AND o.stage IN ('Active', 'Interested', 'Consultation', 'Went cold', 'No response')
          AND (
            b.phone_normalised = "sales-pipe".normalise_phone(p_from) OR
            b.email_normalised = "sales-pipe".normalise_email(p_from)
          )
        ORDER BY t.created_at DESC LIMIT 1;
    END IF;

    -- If still no thread, we can't link it (in real app, put in unmatched queue or similar)
    IF v_thread_id IS NULL THEN
        RETURN;
    END IF;

    -- Check STOP
    IF UPPER(TRIM(p_body)) IN ('STOP', 'UNSUBSCRIBE') THEN
        v_is_stop := true;
    END IF;

    -- Insert message
    INSERT INTO "sales-pipe".messages (
        thread_id, direction, body, send_method, external_message_id, media_url
    ) VALUES (
        v_thread_id, 'inbound', p_body, 'webhook', p_external_message_id, p_media_url
    );

    IF v_is_stop THEN
        UPDATE "sales-pipe".threads SET status = 'Opted out', next_due_on = NULL WHERE id = v_thread_id;
        UPDATE "sales-pipe".opportunities SET stage = 'Do not contact' WHERE id = v_opp_id;
    ELSE
        -- Mark this thread as Replied
        UPDATE "sales-pipe".threads 
        SET status = 'Replied', next_due_on = NULL, last_inbound_at = now()
        WHERE id = v_thread_id;

        -- Pause other threads for this opportunity
        UPDATE "sales-pipe".threads
        SET status = 'Paused', paused_reason = 'Replied on ' || p_platform, next_due_on = NULL
        WHERE opportunity_id = v_opp_id AND id != v_thread_id AND status != 'Replied';
        
        -- Make opportunity Active if it was Went cold or No response
        UPDATE "sales-pipe".opportunities
        SET stage = 'Active'
        WHERE id = v_opp_id AND stage IN ('Went cold', 'No response');

        -- Notify user (simplified: notify assigned sales or consultant)
        INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
        SELECT COALESCE(assigned_consultant_id, assigned_sales_id), 'new_reply', 'New reply on ' || p_platform, '/dashboard'
        FROM "sales-pipe".opportunities
        WHERE id = v_opp_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- STAGE & WIN MANAGEMENT
-- ==============================================================================

CREATE OR REPLACE FUNCTION "sales-pipe".set_stage(
    p_opportunity_id uuid,
    p_stage text,
    p_reason text,
    p_user_id uuid
) RETURNS void AS $$
DECLARE
    v_old_stage text;
BEGIN
    SELECT stage INTO v_old_stage FROM "sales-pipe".opportunities WHERE id = p_opportunity_id;
    IF v_old_stage != p_stage THEN
        UPDATE "sales-pipe".opportunities SET stage = p_stage WHERE id = p_opportunity_id;
        
        INSERT INTO "sales-pipe".stage_changes (opportunity_id, from_stage, to_stage, reason, changed_by)
        VALUES (p_opportunity_id, v_old_stage, p_stage, p_reason, p_user_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION "sales-pipe".record_win(
    p_opportunity_id uuid,
    p_services_won text[],
    p_converted_through text,
    p_user_id uuid
) RETURNS void AS $$
DECLARE
    v_opp record;
    v_conv_type text;
BEGIN
    SELECT * INTO v_opp FROM "sales-pipe".opportunities WHERE id = p_opportunity_id;
    
    -- Calculate conversion type
    -- Simplified arrays comparison (requires some logic to determine As pitched, Expanded, etc.)
    -- As pitched: arrays are equal
    -- Expanded: won contains all pitched + more
    -- Narrowed: won is subset of pitched
    -- Switched: won contains items not in pitched (and pitched items are missing)
    -- For SQL simplicity, we'll just set it to 'As pitched' for now unless we implement full array logic.
    IF v_opp.services_pitched @> p_services_won AND p_services_won @> v_opp.services_pitched THEN
        v_conv_type := 'As pitched';
    ELSIF p_services_won @> v_opp.services_pitched THEN
        v_conv_type := 'Expanded';
    ELSIF v_opp.services_pitched @> p_services_won THEN
        v_conv_type := 'Narrowed';
    ELSE
        v_conv_type := 'Switched';
    END IF;

    UPDATE "sales-pipe".opportunities 
    SET stage = 'Won',
        won_at = now(),
        services_won = p_services_won,
        converted_through = p_converted_through,
        conversion_type = v_conv_type,
        upsell_reminder_on = CURRENT_DATE + interval '30 days'
    WHERE id = p_opportunity_id;

    INSERT INTO "sales-pipe".stage_changes (opportunity_id, from_stage, to_stage, from_services, to_services, reason, changed_by)
    VALUES (p_opportunity_id, v_opp.stage, 'Won', v_opp.services_pitched, p_services_won, 'Won deal', p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- HANDOVER & BOOKINGS
-- ==============================================================================

CREATE OR REPLACE FUNCTION "sales-pipe".hand_over(
    p_opportunity_id uuid,
    p_consultation_at timestamptz,
    p_user_id uuid
) RETURNS void AS $$
BEGIN
    UPDATE "sales-pipe".opportunities 
    SET stage = 'Consultation', consultation_at = p_consultation_at
    WHERE id = p_opportunity_id;

    INSERT INTO "sales-pipe".stage_changes (opportunity_id, from_stage, to_stage, reason, changed_by)
    VALUES (p_opportunity_id, (SELECT stage FROM "sales-pipe".opportunities WHERE id = p_opportunity_id), 'Consultation', 'Handed over', p_user_id);

    -- Notify admins
    INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
    SELECT id, 'needs_consultant', 'Consultation booked, needs assignment', '/dashboard'
    FROM "sales-pipe".profiles WHERE role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION "sales-pipe".assign_consultant(
    p_opportunity_id uuid,
    p_consultant_id uuid
) RETURNS void AS $$
BEGIN
    UPDATE "sales-pipe".opportunities 
    SET assigned_consultant_id = p_consultant_id
    WHERE id = p_opportunity_id;

    -- Notify consultant
    INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
    VALUES (p_consultant_id, 'assigned_to_you', 'You have been assigned a consultation', '/dashboard');
    
    -- Notify sales rep
    INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
    SELECT assigned_sales_id, 'system', 'Consultant assigned', '/dashboard'
    FROM "sales-pipe".opportunities WHERE id = p_opportunity_id AND assigned_sales_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Booking Match Trigger
CREATE OR REPLACE FUNCTION "sales-pipe".trg_match_booking()
RETURNS trigger AS $$
DECLARE
    v_opp_id uuid;
    v_count int;
BEGIN
    SELECT COUNT(*), MAX(o.id) INTO v_count, v_opp_id
    FROM "sales-pipe".opportunities o
    JOIN "sales-pipe".businesses b ON o.business_id = b.id
    WHERE o.stage IN ('Active', 'Interested', 'Went cold', 'No response')
      AND (
        (NEW.phone_normalised IS NOT NULL AND b.phone_normalised = NEW.phone_normalised) OR
        (NEW.email_normalised IS NOT NULL AND b.email_normalised = NEW.email_normalised)
      );

    IF v_count = 1 THEN
        NEW.match_status := 'matched';
        NEW.matched_opportunity_id := v_opp_id;
        -- Can't call hand_over directly here easily with user_id, but we'll inline it
        UPDATE "sales-pipe".opportunities SET stage = 'Consultation', consultation_at = NEW.booked_for WHERE id = v_opp_id;
        INSERT INTO "sales-pipe".notifications (user_id, type, title)
        SELECT id, 'needs_consultant', 'Consultation booked, needs assignment' FROM "sales-pipe".profiles WHERE role = 'admin';
    ELSE
        NEW.match_status := 'unmatched';
        INSERT INTO "sales-pipe".notifications (user_id, type, title)
        SELECT id, 'booking_unmatched', 'Unmatched booking requires attention' FROM "sales-pipe".profiles WHERE role = 'admin';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_booking_match ON "sales-pipe".consultation_bookings;
CREATE TRIGGER trg_booking_match
    BEFORE INSERT ON "sales-pipe".consultation_bookings
    FOR EACH ROW EXECUTE FUNCTION "sales-pipe".trg_match_booking();
