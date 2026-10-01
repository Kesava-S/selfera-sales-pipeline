-- ==========================================
-- COMPILED MIGRATIONS (13 to 26)
-- ==========================================

-- ==========================================
-- 13_v2_schema_setup.sql
-- ==========================================

-- ==============================================================================
-- 13_v2_schema_setup.sql
-- Selfera Sales Dashboard v2 Schema Upgrade
-- ==============================================================================

SET search_path TO "sales-pipe", public;

-- ==============================================================================
-- RENAME LEGACY TABLES
-- ==============================================================================
-- We rename them now so we can safely create new tables (especially templates)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'leads' AND n.nspname = 'sales-pipe') THEN
        ALTER TABLE "sales-pipe".leads RENAME TO leads_legacy;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'tasks' AND n.nspname = 'sales-pipe') THEN
        ALTER TABLE "sales-pipe".tasks RENAME TO tasks_legacy;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'activity_log' AND n.nspname = 'sales-pipe') THEN
        ALTER TABLE "sales-pipe".activity_log RENAME TO activity_log_legacy;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'templates' AND n.nspname = 'sales-pipe') THEN
        ALTER TABLE "sales-pipe".templates RENAME TO templates_legacy;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'lead_service_history' AND n.nspname = 'sales-pipe') THEN
        ALTER TABLE "sales-pipe".lead_service_history RENAME TO lead_service_history_legacy;
    END IF;
END $$;


-- ==============================================================================
-- 1. ENUMS AND CHECK CONSTRAINTS PREPARATION
-- ==============================================================================
-- We will use Check Constraints (TEXT) as requested ("Use Postgres enums or check constraints for all fixed value lists below") to avoid dropping/recreating enums on changes.

-- ==============================================================================
-- 2. PROFILES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "sales-pipe".profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    role text NOT NULL CHECK (role IN ('admin', 'sales', 'consultant')),
    capacity int DEFAULT 150,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- ==============================================================================
-- 3. BUSINESSES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "sales-pipe".businesses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    business_code text UNIQUE, -- Handled by trigger
    business_name text NOT NULL,
    category text,
    business_type text NOT NULL,
    tier text CHECK (tier IN ('1-2 star', '3 star', '4-5 star')),
    room_count int,
    area text,
    address text,
    postcode text,
    maps_link text,
    google_rating numeric,
    google_reviews_count int,
    phone text,
    phone_normalised text,
    whatsapp_number text,
    email text,
    email_normalised text,
    instagram text,
    facebook text,
    existing_website text,
    company_type text DEFAULT 'Unknown' CHECK (company_type IN ('Limited company', 'Sole trader', 'Partnership', 'Unknown')),
    contact_name text,
    notes text,
    archived boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bus_phone_norm ON "sales-pipe".businesses(phone_normalised) WHERE phone_normalised IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bus_email_norm ON "sales-pipe".businesses(email_normalised) WHERE email_normalised IS NOT NULL;

-- Business Code Trigger
CREATE OR REPLACE FUNCTION "sales-pipe".generate_business_code()
RETURNS trigger AS $$
DECLARE
    next_id int;
BEGIN
    IF NEW.business_code IS NULL THEN
        -- Basic sequential counter. In a real system, you might use a sequence.
        SELECT COUNT(*) + 1 INTO next_id FROM "sales-pipe".businesses;
        NEW.business_code := 'BZ-' || LPAD(next_id::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_generate_business_code ON "sales-pipe".businesses;
CREATE TRIGGER trg_generate_business_code
    BEFORE INSERT ON "sales-pipe".businesses
    FOR EACH ROW EXECUTE FUNCTION "sales-pipe".generate_business_code();

-- ==============================================================================
-- 4. OPPORTUNITIES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "sales-pipe".opportunities (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    opportunity_code text UNIQUE,
    business_id uuid NOT NULL REFERENCES "sales-pipe".businesses(id) ON DELETE CASCADE,
    services_pitched text[] NOT NULL CHECK (array_length(services_pitched, 1) > 0),
    services_won text[],
    conversion_type text CHECK (conversion_type IN ('As pitched', 'Expanded', 'Switched', 'Narrowed')),
    converted_through text CHECK (converted_through IN ('Direct from outreach', 'Consultation', 'Demo', 'Follow-up conversation')),
    stage text DEFAULT 'Needs review' CHECK (stage IN ('Needs review', 'Active', 'Interested', 'Consultation', 'Won', 'Went cold', 'No response', 'Declined', 'Do not contact')),
    demo_link text,
    assigned_sales_id uuid REFERENCES "sales-pipe".profiles(id),
    assigned_consultant_id uuid REFERENCES "sales-pipe".profiles(id),
    consultation_at timestamptz,
    source_opportunity_id uuid REFERENCES "sales-pipe".opportunities(id),
    won_at timestamptz,
    closed_at timestamptz,
    upsell_reminder_on date,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opps_stage ON "sales-pipe".opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_opps_bus ON "sales-pipe".opportunities(business_id);
CREATE INDEX IF NOT EXISTS idx_opps_sales ON "sales-pipe".opportunities(assigned_sales_id);
CREATE INDEX IF NOT EXISTS idx_opps_consultant ON "sales-pipe".opportunities(assigned_consultant_id);
CREATE INDEX IF NOT EXISTS idx_opps_services ON "sales-pipe".opportunities USING GIN(services_pitched);

-- Opportunity Code Trigger
CREATE OR REPLACE FUNCTION "sales-pipe".generate_opportunity_code()
RETURNS trigger AS $$
DECLARE
    next_id int;
BEGIN
    IF NEW.opportunity_code IS NULL THEN
        SELECT COUNT(*) + 1 INTO next_id FROM "sales-pipe".opportunities;
        NEW.opportunity_code := 'OP-' || LPAD(next_id::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_generate_opp_code ON "sales-pipe".opportunities;
CREATE TRIGGER trg_generate_opp_code
    BEFORE INSERT ON "sales-pipe".opportunities
    FOR EACH ROW EXECUTE FUNCTION "sales-pipe".generate_opportunity_code();

-- ==============================================================================
-- 5. THREADS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "sales-pipe".threads (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    opportunity_id uuid NOT NULL REFERENCES "sales-pipe".opportunities(id) ON DELETE CASCADE,
    platform text NOT NULL CHECK (platform IN ('WhatsApp', 'Instagram', 'Facebook', 'Email', 'Phone', 'Walk-in')),
    status text DEFAULT 'Not contacted' CHECK (status IN ('Not contacted', 'Awaiting reply', 'Replied', 'Paused', 'No reply', 'Opted out')),
    step int DEFAULT 0 CHECK (step BETWEEN 0 AND 4),
    next_due_on date,
    last_outbound_at timestamptz,
    last_inbound_at timestamptz,
    paused_reason text,
    external_thread_id text,
    created_at timestamptz DEFAULT now(),
    UNIQUE(opportunity_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_threads_next_due ON "sales-pipe".threads(next_due_on);
CREATE INDEX IF NOT EXISTS idx_threads_status ON "sales-pipe".threads(status);
CREATE INDEX IF NOT EXISTS idx_threads_platform ON "sales-pipe".threads(platform);

-- ==============================================================================
-- 6. MESSAGES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "sales-pipe".messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id uuid NOT NULL REFERENCES "sales-pipe".threads(id) ON DELETE CASCADE,
    direction text NOT NULL CHECK (direction IN ('outbound', 'inbound', 'system')),
    body text NOT NULL,
    subject text,
    template_id uuid, -- will reference templates later
    step_label text,
    send_method text CHECK (send_method IN ('api', 'manual', 'webhook')),
    external_message_id text UNIQUE,
    media_url text,
    sent_by uuid REFERENCES "sales-pipe".profiles(id),
    delivery_status text CHECK (delivery_status IN ('queued', 'sent', 'failed')),
    error_detail text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_thread_time ON "sales-pipe".messages(thread_id, created_at DESC);

-- ==============================================================================
-- 7. TEMPLATES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "sales-pipe".templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    platform text NOT NULL CHECK (platform IN ('WhatsApp', 'Instagram', 'Facebook', 'Email', 'Phone', 'Walk-in')),
    step text NOT NULL CHECK (step IN ('First contact', 'Follow-up 1', 'Follow-up 2', 'Final check', 'Reply', 'Upsell')),
    services text[] NOT NULL,
    business_types text[] DEFAULT '{}',
    subject text,
    body text NOT NULL,
    whatsapp_template_name text,
    is_active boolean DEFAULT true,
    updated_at timestamptz DEFAULT now()
);

-- ==============================================================================
-- 8. DRAFTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "sales-pipe".drafts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id uuid NOT NULL REFERENCES "sales-pipe".threads(id) ON DELETE CASCADE,
    step_label text NOT NULL,
    template_id uuid REFERENCES "sales-pipe".templates(id),
    body text NOT NULL,
    subject text,
    missing_fields text[],
    status text DEFAULT 'ready' CHECK (status IN ('ready', 'needs_data', 'sent', 'discarded')),
    due_on date NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- ==============================================================================
-- 9. CONSULTATION BOOKINGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "sales-pipe".consultation_bookings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    business_name text NOT NULL,
    email text,
    phone text,
    booked_for timestamptz NOT NULL,
    message text,
    email_normalised text,
    phone_normalised text,
    matched_opportunity_id uuid REFERENCES "sales-pipe".opportunities(id) ON DELETE SET NULL,
    match_status text DEFAULT 'unmatched' CHECK (match_status IN ('matched', 'unmatched', 'linked_manually')),
    created_at timestamptz DEFAULT now()
);

-- ==============================================================================
-- 10. STAGE CHANGES (AUDIT)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "sales-pipe".stage_changes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    opportunity_id uuid NOT NULL REFERENCES "sales-pipe".opportunities(id) ON DELETE CASCADE,
    from_stage text,
    to_stage text,
    from_services text[],
    to_services text[],
    reason text,
    changed_by uuid REFERENCES "sales-pipe".profiles(id),
    created_at timestamptz DEFAULT now()
);

-- ==============================================================================
-- 11. NOTIFICATIONS (RE-USE OR ADJUST EXISTING IF NEEDED)
-- ==============================================================================
-- The previous schema already had `notifications`, but it had different constraints.
-- Let's just create a new one or modify it. Assuming we can alter or recreate.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'notifications' AND n.nspname = 'sales-pipe') THEN
        ALTER TABLE "sales-pipe".notifications RENAME TO notifications_legacy;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "sales-pipe".notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES "sales-pipe".profiles(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('new_reply', 'booking_matched', 'booking_unmatched', 'needs_consultant', 'assigned_to_you', 'upsell_due')),
    title text NOT NULL,
    link text,
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- ==============================================================================
-- 12. AUTOMATIC UPDATED_AT TRIGGERS
-- ==============================================================================
CREATE OR REPLACE FUNCTION "sales-pipe".update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_bus_updated_at ON "sales-pipe".businesses;
CREATE TRIGGER trg_bus_updated_at BEFORE UPDATE ON "sales-pipe".businesses
FOR EACH ROW EXECUTE FUNCTION "sales-pipe".update_updated_at_column();

DROP TRIGGER IF EXISTS trg_opps_updated_at ON "sales-pipe".opportunities;
CREATE TRIGGER trg_opps_updated_at BEFORE UPDATE ON "sales-pipe".opportunities
FOR EACH ROW EXECUTE FUNCTION "sales-pipe".update_updated_at_column();


-- ==========================================
-- 15_v2_functions_part1.sql
-- ==========================================

-- ==============================================================================
-- 15_v2_functions.sql
-- Core business logic functions for Selfera Sales Dashboard v2
-- ==============================================================================

SET search_path TO "sales-pipe", public;

-- ==============================================================================
-- UTILITY FUNCTIONS
-- ==============================================================================

CREATE OR REPLACE FUNCTION "sales-pipe".normalise_phone(p_phone text) 
RETURNS text AS $$
DECLARE
    clean_phone text;
BEGIN
    IF p_phone IS NULL OR trim(p_phone) = '' THEN RETURN NULL; END IF;
    clean_phone := regexp_replace(p_phone, '[^\d+]', '', 'g');
    
    -- If it starts with 07 (UK mobile), convert to +44
    IF clean_phone LIKE '07%' THEN
        clean_phone := '+44' || substr(clean_phone, 2);
    -- If it doesn't have a plus but has country code, prepend +
    ELSIF clean_phone NOT LIKE '+%' AND clean_phone ~ '^[1-9]' THEN
        clean_phone := '+' || clean_phone;
    END IF;
    
    RETURN clean_phone;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION "sales-pipe".normalise_email(p_email text) 
RETURNS text AS $$
BEGIN
    IF p_email IS NULL OR trim(p_email) = '' THEN RETURN NULL; END IF;
    RETURN LOWER(TRIM(p_email));
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

-- Trigger to automatically normalise on businesses
CREATE OR REPLACE FUNCTION "sales-pipe".trg_normalise_business_contact()
RETURNS trigger AS $$
BEGIN
    NEW.phone_normalised := "sales-pipe".normalise_phone(NEW.phone);
    NEW.email_normalised := "sales-pipe".normalise_email(NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_bus_normalise ON "sales-pipe".businesses;
CREATE TRIGGER trg_bus_normalise
    BEFORE INSERT OR UPDATE OF phone, email ON "sales-pipe".businesses
    FOR EACH ROW EXECUTE FUNCTION "sales-pipe".trg_normalise_business_contact();


-- ==============================================================================
-- ASSIGNMENT LOGIC
-- ==============================================================================

CREATE OR REPLACE FUNCTION "sales-pipe".auto_assign_sales(p_opportunity_ids uuid[])
RETURNS void AS $$
DECLARE
    sales_rep record;
    opp_id uuid;
    reps_available uuid[];
    rep_idx int := 1;
BEGIN
    -- Find active sales profiles and calculate their current load
    -- Current load = count of opps in 'Active', 'Interested', 'Consultation' assigned to them
    SELECT array_agg(p.id) INTO reps_available
    FROM "sales-pipe".profiles p
    LEFT JOIN "sales-pipe".opportunities o 
        ON o.assigned_sales_id = p.id AND o.stage IN ('Active', 'Interested', 'Consultation')
    WHERE p.role = 'sales' AND p.is_active = true
    GROUP BY p.id, p.capacity
    HAVING count(o.id) < p.capacity
    ORDER BY count(o.id) ASC; -- Least loaded first

    IF reps_available IS NULL OR array_length(reps_available, 1) = 0 THEN
        -- Notify admin that no sales reps have capacity
        INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
        SELECT id, 'needs_consultant', 'No sales capacity for auto-assignment', '/dashboard'
        FROM "sales-pipe".profiles WHERE role = 'admin';
        RETURN;
    END IF;

    -- Round robin assignment
    FOREACH opp_id IN ARRAY p_opportunity_ids
    LOOP
        UPDATE "sales-pipe".opportunities 
        SET assigned_sales_id = reps_available[rep_idx]
        WHERE id = opp_id;

        rep_idx := rep_idx + 1;
        IF rep_idx > array_length(reps_available, 1) THEN
            rep_idx := 1;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- DRAFT GENERATION
-- ==============================================================================

CREATE OR REPLACE FUNCTION "sales-pipe".generate_draft(p_thread_id uuid, p_step text)
RETURNS void AS $$
DECLARE
    v_opp record;
    v_bus record;
    v_thread record;
    v_template record;
    v_body text;
    v_subject text;
    v_missing text[] := '{}';
BEGIN
    SELECT * INTO v_thread FROM "sales-pipe".threads WHERE id = p_thread_id;
    SELECT * INTO v_opp FROM "sales-pipe".opportunities WHERE id = v_thread.opportunity_id;
    SELECT * INTO v_bus FROM "sales-pipe".businesses WHERE id = v_opp.business_id;

    -- Pick the best template
    -- Match: service + platform + business_type > service + platform > platform general
    SELECT * INTO v_template
    FROM "sales-pipe".templates
    WHERE is_active = true
      AND platform = v_thread.platform
      AND step = p_step
      AND (v_opp.services_pitched[1] = ANY(services) OR array_length(services, 1) = 0)
    ORDER BY 
      CASE WHEN v_bus.business_type = ANY(business_types) THEN 1 ELSE 2 END ASC,
      CASE WHEN v_opp.services_pitched[1] = ANY(services) THEN 1 ELSE 2 END ASC
    LIMIT 1;

    IF v_template IS NULL THEN
        -- Create a blank draft if no template found
        INSERT INTO "sales-pipe".drafts (thread_id, step_label, body, status, due_on)
        VALUES (p_thread_id, p_step, '', 'needs_data', CURRENT_DATE);
        RETURN;
    END IF;

    v_body := v_template.body;
    v_subject := v_template.subject;

    -- Replace placeholders
    -- {business}
    IF v_body LIKE '%{business}%' THEN
        IF v_bus.business_name IS NOT NULL THEN
            v_body := replace(v_body, '{business}', v_bus.business_name);
        ELSE
            v_missing := array_append(v_missing, 'business_name');
        END IF;
    END IF;

    -- {contact_name}
    IF v_body LIKE '%{contact_name}%' THEN
        IF v_bus.contact_name IS NOT NULL THEN
            v_body := replace(v_body, '{contact_name}', v_bus.contact_name);
        ELSE
            v_missing := array_append(v_missing, 'contact_name');
        END IF;
    END IF;

    -- {area}
    IF v_body LIKE '%{area}%' THEN
        IF v_bus.area IS NOT NULL THEN
            v_body := replace(v_body, '{area}', v_bus.area);
        ELSE
            v_missing := array_append(v_missing, 'area');
        END IF;
    END IF;

    -- Create draft
    INSERT INTO "sales-pipe".drafts (
        thread_id, step_label, template_id, body, subject, missing_fields, status, due_on
    ) VALUES (
        p_thread_id, p_step, v_template.id, v_body, v_subject, v_missing,
        CASE WHEN array_length(v_missing, 1) > 0 THEN 'needs_data' ELSE 'ready' END,
        CURRENT_DATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- IMPORT APPROVAL
-- ==============================================================================

CREATE OR REPLACE FUNCTION "sales-pipe".approve_import(p_business_ids uuid[])
RETURNS void AS $$
DECLARE
    bus_id uuid;
    opp record;
    platforms text[];
    p text;
BEGIN
    FOR bus_id IN SELECT unnest(p_business_ids)
    LOOP
        -- Find opportunities for this business that are in 'Needs review'
        FOR opp IN SELECT * FROM "sales-pipe".opportunities WHERE business_id = bus_id AND stage = 'Needs review'
        LOOP
            -- 1. Validate (just checking if required fields exist, we assume frontend checked, but to be safe)
            -- 2. Set to active
            UPDATE "sales-pipe".opportunities SET stage = 'Active' WHERE id = opp.id;

            -- 3. Create threads for available platforms
            -- (We'll simplify and assume we create threads based on what contact info is available)
            platforms := '{}';
            IF EXISTS (SELECT 1 FROM "sales-pipe".businesses WHERE id = bus_id AND email IS NOT NULL) THEN
                platforms := array_append(platforms, 'Email');
            END IF;
            IF EXISTS (SELECT 1 FROM "sales-pipe".businesses WHERE id = bus_id AND (whatsapp_number IS NOT NULL OR phone IS NOT NULL)) THEN
                platforms := array_append(platforms, 'WhatsApp');
            END IF;
            IF EXISTS (SELECT 1 FROM "sales-pipe".businesses WHERE id = bus_id AND instagram IS NOT NULL) THEN
                platforms := array_append(platforms, 'Instagram');
            END IF;
            IF EXISTS (SELECT 1 FROM "sales-pipe".businesses WHERE id = bus_id AND facebook IS NOT NULL) THEN
                platforms := array_append(platforms, 'Facebook');
            END IF;

            IF array_length(platforms, 1) IS NULL THEN
                -- If no platforms, default to walk-in or phone if phone exists
                platforms := ARRAY['Phone'];
            END IF;

            FOREACH p IN ARRAY platforms
            LOOP
                INSERT INTO "sales-pipe".threads (opportunity_id, platform, status, step, next_due_on)
                VALUES (opp.id, p, 'Not contacted', 0, CURRENT_DATE);
            END LOOP;
            
        END LOOP;
    END LOOP;

    -- 4. Auto-assignment (Call auto_assign for all opps just activated)
    PERFORM "sales-pipe".auto_assign_sales(
        ARRAY(SELECT id FROM "sales-pipe".opportunities WHERE business_id = ANY(p_business_ids) AND stage = 'Active' AND assigned_sales_id IS NULL)
    );

    -- 5. Generate first contact drafts
    DECLARE
        t record;
    BEGIN
        FOR t IN SELECT id FROM "sales-pipe".threads WHERE opportunity_id IN (SELECT id FROM "sales-pipe".opportunities WHERE business_id = ANY(p_business_ids))
        LOOP
            PERFORM "sales-pipe".generate_draft(t.id, 'First contact');
        END LOOP;
    END;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- 16_v2_functions_part2.sql
-- ==========================================

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


-- ==========================================
-- 17_v2_functions_part3.sql
-- ==========================================

-- ==============================================================================
-- 17_v2_functions_part3.sql
-- Daily update and UI aggregation functions (Views)
-- ==============================================================================

SET search_path TO "sales-pipe", public;

-- ==============================================================================
-- DAILY UPDATE
-- ==============================================================================

CREATE OR REPLACE FUNCTION "sales-pipe".daily_update()
RETURNS void AS $$
DECLARE
    t record;
BEGIN
    -- 1. Create drafts for threads whose next_due_on <= today and step < 4
    FOR t IN 
        SELECT t.id, t.step 
        FROM "sales-pipe".threads t
        WHERE t.next_due_on <= CURRENT_DATE 
          AND t.step < 4
          AND t.status IN ('Not contacted', 'Awaiting reply')
    LOOP
        PERFORM "sales-pipe".generate_draft(
            t.id, 
            CASE 
                WHEN t.step = 0 THEN 'First contact'
                WHEN t.step = 1 THEN 'Follow-up 1'
                WHEN t.step = 2 THEN 'Follow-up 2'
                WHEN t.step = 3 THEN 'Final check'
            END
        );
    END LOOP;

    -- 2. Mark threads No reply when final check was sent 14+ days ago
    UPDATE "sales-pipe".threads
    SET status = 'No reply', next_due_on = NULL
    WHERE step = 4 
      AND status = 'Awaiting reply'
      AND last_outbound_at < (CURRENT_DATE - interval '14 days'); -- Should be working days in prod

    -- 3. Set opportunity No response when every contacted thread is No reply
    UPDATE "sales-pipe".opportunities o
    SET stage = 'No response'
    WHERE o.stage = 'Active'
      AND NOT EXISTS (
          SELECT 1 FROM "sales-pipe".threads t 
          WHERE t.opportunity_id = o.id AND t.status != 'No reply' AND t.step > 0
      )
      AND NOT EXISTS (
          SELECT 1 FROM "sales-pipe".threads t 
          WHERE t.opportunity_id = o.id AND t.last_inbound_at IS NOT NULL
      );

    -- 4. Set opportunity Went cold when business replied at least once, 
    -- then we sent 2+ outbound, latest is 5+ days old, no answer.
    UPDATE "sales-pipe".opportunities o
    SET stage = 'Went cold'
    WHERE o.stage IN ('Active', 'Interested')
      AND EXISTS (
          SELECT 1 FROM "sales-pipe".threads t
          WHERE t.opportunity_id = o.id AND t.last_inbound_at IS NOT NULL
      )
      AND EXISTS (
          SELECT 1 FROM "sales-pipe".threads t
          WHERE t.opportunity_id = o.id 
            AND t.last_outbound_at > t.last_inbound_at
            AND t.last_outbound_at < (CURRENT_DATE - interval '5 days')
            AND (SELECT count(*) FROM "sales-pipe".messages m WHERE m.thread_id = t.id AND m.direction = 'outbound' AND m.created_at > t.last_inbound_at) >= 2
      );

    -- 5. Upsell drafts
    FOR t IN 
        SELECT id FROM "sales-pipe".opportunities
        WHERE stage = 'Won' AND upsell_reminder_on <= CURRENT_DATE
    LOOP
        INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
        SELECT assigned_sales_id, 'upsell_due', 'Upsell due for ' || (SELECT business_name FROM "sales-pipe".businesses WHERE id = t.business_id), '/dashboard'
        FROM "sales-pipe".opportunities WHERE id = t.id;
        
        -- Prevent spamming notifications by pushing the date far out or nulling it
        UPDATE "sales-pipe".opportunities SET upsell_reminder_on = NULL WHERE id = t.id;
    END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- UI AGGREGATION RPCs (VIEWS)
-- ==============================================================================

-- Dashboard Status Counts
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
    SELECT
        (SELECT count(*) FROM "sales-pipe".threads t JOIN "sales-pipe".opportunities o ON t.opportunity_id = o.id WHERE (v_role = 'admin' OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user) AND t.status = 'Replied'),
        (SELECT count(*) FROM "sales-pipe".opportunities o WHERE (v_role = 'admin' OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user) AND o.stage = 'Interested'),
        (SELECT count(*) FROM "sales-pipe".opportunities o WHERE (v_role = 'admin' OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user) AND o.stage = 'Consultation'),
        (SELECT count(*) FROM "sales-pipe".opportunities o WHERE (v_role = 'admin' OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user) AND o.stage = 'Went cold'),
        (SELECT count(*) FROM "sales-pipe".opportunities o WHERE (v_role = 'admin' OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user) AND o.stage = 'No response'),
        (CASE WHEN v_role = 'admin' THEN (SELECT count(*) FROM "sales-pipe".opportunities WHERE stage = 'Consultation' AND assigned_consultant_id IS NULL) ELSE 0 END),
        (CASE WHEN v_role = 'admin' THEN (SELECT count(*) FROM "sales-pipe".consultation_bookings WHERE match_status = 'unmatched') ELSE 0 END);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Service Counts
CREATE OR REPLACE FUNCTION "sales-pipe".v_service_counts(p_user uuid)
RETURNS TABLE (
    service_name text,
    replies_count bigint,
    active_count bigint,
    won_count bigint
) AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role FROM "sales-pipe".profiles WHERE id = p_user;

    RETURN QUERY
    SELECT 
        s.srv AS service_name,
        COUNT(DISTINCT CASE WHEN t.status = 'Replied' THEN o.id END) AS replies_count,
        COUNT(DISTINCT CASE WHEN o.stage = 'Active' THEN o.id END) AS active_count,
        COUNT(DISTINCT CASE WHEN o.stage = 'Won' THEN o.id END) AS won_count
    FROM unnest(ARRAY['Website', 'Micro Automation', 'End-to-End Automation', 'Custom Dashboard', 'Cold Outreach']) AS s(srv)
    LEFT JOIN "sales-pipe".opportunities o ON s.srv = ANY(o.services_pitched) AND (v_role = 'admin' OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user)
    LEFT JOIN "sales-pipe".threads t ON t.opportunity_id = o.id
    GROUP BY s.srv;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Business Type Counts
CREATE OR REPLACE FUNCTION "sales-pipe".v_business_type_counts(p_service text, p_user uuid)
RETURNS TABLE (
    business_type text,
    businesses_count bigint,
    replies_count bigint,
    due_today_count bigint
) AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role FROM "sales-pipe".profiles WHERE id = p_user;

    RETURN QUERY
    SELECT 
        b.business_type,
        COUNT(DISTINCT b.id) AS businesses_count,
        COUNT(DISTINCT CASE WHEN t.status = 'Replied' THEN o.id END) AS replies_count,
        COUNT(DISTINCT CASE WHEN t.next_due_on <= CURRENT_DATE THEN o.id END) AS due_today_count
    FROM "sales-pipe".businesses b
    JOIN "sales-pipe".opportunities o ON o.business_id = b.id
    LEFT JOIN "sales-pipe".threads t ON t.opportunity_id = o.id
    WHERE p_service = ANY(o.services_pitched)
      AND (v_role = 'admin' OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user)
    GROUP BY b.business_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The other views (v_business_cards, v_due_today) will be implemented as standard joins in Next.js to leverage PostgREST pagination easily, as custom RPCs for pagination require manual OFFSET/LIMIT handling.


-- ==========================================
-- 18_v2_rls_policies.sql
-- ==========================================

-- ==============================================================================
-- 18_v2_rls_policies.sql
-- Row Level Security for Selfera Sales Dashboard v2
-- ==============================================================================

SET search_path TO "sales-pipe", public;

-- ==============================================================================
-- ENABLE RLS
-- ==============================================================================

ALTER TABLE "sales-pipe".profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe".businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe".opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe".threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe".messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe".templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe".drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe".consultation_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe".stage_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe".notifications ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- PROFILES
-- ==============================================================================
-- Profiles can be read by anyone authenticated. Admins can manage them.
CREATE POLICY "Profiles read" ON "sales-pipe".profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Profiles manage admin" ON "sales-pipe".profiles FOR ALL USING (
    (SELECT role FROM "sales-pipe".profiles WHERE id = auth.uid()) = 'admin'
) WITH CHECK (
    (SELECT role FROM "sales-pipe".profiles WHERE id = auth.uid()) = 'admin'
);

-- ==============================================================================
-- BUSINESSES
-- ==============================================================================
-- All authenticated users can read and create businesses
CREATE POLICY "Businesses read" ON "sales-pipe".businesses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Businesses insert" ON "sales-pipe".businesses FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Businesses update" ON "sales-pipe".businesses FOR UPDATE USING (auth.role() = 'authenticated');

-- ==============================================================================
-- OPPORTUNITIES
-- ==============================================================================
-- Read: admin (all), sales (assigned to them), consultant (assigned to them)
CREATE POLICY "Opportunities read" ON "sales-pipe".opportunities FOR SELECT USING (
    auth.role() = 'authenticated' AND (
        (SELECT role FROM "sales-pipe".profiles WHERE id = auth.uid()) = 'admin'
        OR assigned_sales_id = auth.uid()
        OR assigned_consultant_id = auth.uid()
        -- Also let them read if unassigned (so they can see new imports before assignment)
        OR (assigned_sales_id IS NULL AND assigned_consultant_id IS NULL)
    )
);

CREATE POLICY "Opportunities insert" ON "sales-pipe".opportunities FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Opportunities update" ON "sales-pipe".opportunities FOR UPDATE USING (
    auth.role() = 'authenticated' AND (
        (SELECT role FROM "sales-pipe".profiles WHERE id = auth.uid()) = 'admin'
        OR assigned_sales_id = auth.uid()
        OR assigned_consultant_id = auth.uid()
    )
);

-- ==============================================================================
-- THREADS, MESSAGES, DRAFTS, STAGE_CHANGES
-- ==============================================================================
-- These cascade off the opportunity permissions
CREATE POLICY "Threads access" ON "sales-pipe".threads FOR ALL USING (
    EXISTS (SELECT 1 FROM "sales-pipe".opportunities o WHERE o.id = opportunity_id)
);

CREATE POLICY "Messages access" ON "sales-pipe".messages FOR ALL USING (
    EXISTS (SELECT 1 FROM "sales-pipe".threads t JOIN "sales-pipe".opportunities o ON t.opportunity_id = o.id WHERE t.id = thread_id)
);

CREATE POLICY "Drafts access" ON "sales-pipe".drafts FOR ALL USING (
    EXISTS (SELECT 1 FROM "sales-pipe".threads t JOIN "sales-pipe".opportunities o ON t.opportunity_id = o.id WHERE t.id = thread_id)
);

CREATE POLICY "Stage_changes access" ON "sales-pipe".stage_changes FOR ALL USING (
    EXISTS (SELECT 1 FROM "sales-pipe".opportunities o WHERE o.id = opportunity_id)
);

-- ==============================================================================
-- TEMPLATES
-- ==============================================================================
-- All roles read, only admin writes
CREATE POLICY "Templates read" ON "sales-pipe".templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Templates write admin" ON "sales-pipe".templates FOR ALL USING (
    (SELECT role FROM "sales-pipe".profiles WHERE id = auth.uid()) = 'admin'
);

-- ==============================================================================
-- CONSULTATION BOOKINGS
-- ==============================================================================
-- Insert only via service role (API). Read by admin and assigned sales.
CREATE POLICY "Consultation bookings read admin" ON "sales-pipe".consultation_bookings FOR SELECT USING (
    (SELECT role FROM "sales-pipe".profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Consultation bookings read sales" ON "sales-pipe".consultation_bookings FOR SELECT USING (
    EXISTS (SELECT 1 FROM "sales-pipe".opportunities o WHERE o.id = matched_opportunity_id AND o.assigned_sales_id = auth.uid())
);
CREATE POLICY "Consultation bookings update admin" ON "sales-pipe".consultation_bookings FOR UPDATE USING (
    (SELECT role FROM "sales-pipe".profiles WHERE id = auth.uid()) = 'admin'
);

-- ==============================================================================
-- NOTIFICATIONS
-- ==============================================================================
-- Users only see their own
CREATE POLICY "Notifications access" ON "sales-pipe".notifications FOR ALL USING (
    user_id = auth.uid()
);

-- ==============================================================================
-- PERMISSIONS GRANTS
-- ==============================================================================
-- Revoke anon access from ALL tables in schema
DO $$ 
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'sales-pipe'
    LOOP
        EXECUTE 'REVOKE ALL ON TABLE "sales-pipe".' || quote_ident(t) || ' FROM anon;';
        EXECUTE 'GRANT ALL ON TABLE "sales-pipe".' || quote_ident(t) || ' TO authenticated, service_role;';
    END LOOP;
END $$;


-- ==========================================
-- 19_v2_missing_pieces.sql
-- ==========================================

-- 19_v2_missing_pieces.sql

-- 1. Sequences for codes (replacing COUNT(*) + 1)
create sequence if not exists "sales-pipe".business_code_seq start 1000;
create sequence if not exists "sales-pipe".opportunity_code_seq start 1000;

-- 2. Revoke anon access from future tables in the schema
alter default privileges in schema "sales-pipe" revoke all on tables from anon;
alter default privileges in schema "sales-pipe" revoke all on routines from anon;

-- 3. Update the insert triggers/functions to use the sequences
create or replace function "sales-pipe".generate_business_code()
returns trigger as $$
begin
  if NEW.business_code is null then
    NEW.business_code := 'B' || nextval('"sales-pipe".business_code_seq')::text;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create or replace function "sales-pipe".generate_opportunity_code()
returns trigger as $$
begin
  if NEW.opportunity_code is null then
    NEW.opportunity_code := 'OPP' || nextval('"sales-pipe".opportunity_code_seq')::text;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;


-- 4. Admin function to link booking to opportunity
create or replace function "sales-pipe".link_booking(p_booking_id uuid, p_opportunity_id uuid)
returns void as $$
declare
  v_role text;
begin
  select role into v_role from "sales-pipe".profiles where id = auth.uid();
  if v_role != 'admin' then
    raise exception 'Unauthorized: Only admins can link bookings';
  end if;

  update "sales-pipe".bookings
  set opportunity_id = p_opportunity_id
  where id = p_booking_id;
end;
$$ language plpgsql security definer;

-- 5. Helper function for auth scoping
create or replace function "sales-pipe".get_user_role()
returns text as $$
declare
  v_role text;
begin
  select role into v_role from "sales-pipe".profiles where id = auth.uid();
  return coalesce(v_role, 'sales');
end;
$$ language plpgsql security definer;

-- 6. v_business_cards
create or replace function "sales-pipe".v_business_cards(
  p_service text,
  p_type text,
  p_filter text,
  p_search text,
  p_limit int,
  p_offset int
)
returns table (
  opportunity_id uuid,
  business_name text,
  area text,
  google_rating numeric,
  stage text,
  threads jsonb
) as $$
declare
  v_uid uuid := auth.uid();
  v_role text := "sales-pipe".get_user_role();
begin
  return query
  select 
    o.id as opportunity_id,
    b.business_name,
    b.area,
    b.google_rating,
    o.stage,
    (
      select jsonb_agg(
        jsonb_build_object(
          'platform', t.platform,
          'status', t.status,
          'step', t.step
        )
      )
      from "sales-pipe".threads t
      where t.opportunity_id = o.id
    ) as threads
  from "sales-pipe".opportunities o
  join "sales-pipe".businesses b on b.id = o.business_id
  where (p_service = '' or p_service = any(o.services_pitched))
    and (p_type = '' or b.business_type = p_type)
    and (p_filter = 'all' or o.stage = p_filter)
    and (p_search = '' or b.business_name ilike '%' || p_search || '%')
    and (v_role = 'admin' or o.assigned_sales_id = v_uid or o.assigned_consultant_id = v_uid)
  order by o.created_at desc
  limit p_limit offset p_offset;
end;
$$ language plpgsql security definer;

-- 7. v_due_today: final version is in 23_v2_app_functions.sql

-- 8. Assign consultant (admin only check)
create or replace function "sales-pipe".assign_consultant(p_opportunity_id uuid, p_consultant_id uuid)
returns void as $$
declare
  v_role text;
begin
  select role into v_role from "sales-pipe".profiles where id = auth.uid();
  if v_role != 'admin' then
    raise exception 'Unauthorized: Only admins can assign consultants';
  end if;

  update "sales-pipe".opportunities
  set assigned_consultant_id = p_consultant_id
  where id = p_opportunity_id;
end;
$$ language plpgsql security definer;

-- 9. Seed Templates: moved to 22_v2_fixes.sql (the old insert used a table that doesn't exist)


-- ==========================================
-- 20_v2_cadence_rules.sql
-- ==========================================

-- ==============================================================================
-- 20_v2_cadence_rules.sql
-- Follow-up timings shown in Settings. Safe to re-run.
-- ==============================================================================

-- If an earlier run created it in the public schema by mistake, move it
DO $$
BEGIN
  IF to_regclass('public.cadence_rules') IS NOT NULL AND to_regclass('"sales-pipe".cadence_rules') IS NULL THEN
    ALTER TABLE public.cadence_rules SET SCHEMA "sales-pipe";
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "sales-pipe".cadence_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_name text NOT NULL UNIQUE,
  days_delay integer NOT NULL CHECK (days_delay > 0),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "sales-pipe".cadence_rules (step_name, days_delay, description) VALUES
  ('Follow up 1', 3, 'Working days after First contact before Follow-up 1'),
  ('Follow up 2', 5, 'Working days after Follow-up 1 before Follow-up 2'),
  ('Follow up 3', 14, 'Working days after Follow-up 2 before the Final check'),
  ('Went Cold', 14, 'Working days after the Final check before No response')
ON CONFLICT (step_name) DO NOTHING;

ALTER TABLE "sales-pipe".cadence_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cadence read" ON "sales-pipe".cadence_rules;
CREATE POLICY "Cadence read" ON "sales-pipe".cadence_rules FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Cadence write admin" ON "sales-pipe".cadence_rules;
CREATE POLICY "Cadence write admin" ON "sales-pipe".cadence_rules FOR UPDATE
  USING ((SELECT role FROM "sales-pipe".profiles WHERE id = auth.uid()) = 'admin');

REVOKE ALL ON "sales-pipe".cadence_rules FROM anon, public;
GRANT SELECT, UPDATE ON "sales-pipe".cadence_rules TO authenticated;
GRANT ALL ON "sales-pipe".cadence_rules TO service_role;


-- ==========================================
-- 21_v2_auth_trigger.sql
-- ==========================================

-- ==============================================================================
-- 21_v2_auth_trigger.sql
-- Gives every new user a profile so they can log in straight away.
-- New users start as 'sales'. Make someone admin or consultant with:
--   update "sales-pipe".profiles set role = 'admin' where id = '<user id>';
-- Keep public sign-ups turned OFF in Supabase Authentication settings
-- (invite users only), otherwise anyone could create a sales account.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO "sales-pipe".profiles (id, full_name, role)
  VALUES (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    'sales'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ==========================================
-- 22_v2_fixes.sql
-- ==========================================

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

-- 5 and 6. Due today and status counts: final versions are in 23_v2_app_functions.sql

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


-- ==========================================
-- 23_v2_app_functions.sql
-- ==========================================

-- ==============================================================================
-- 23_v2_app_functions.sql
-- Database functions used by the dashboard screens: import, review queue,
-- notes, platform threads, bulk actions, lists and counts. Safe to re-run.
-- Run after 22.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

-- ------------------------------------------------------------------------------
-- 1. Notes on a pitch (the "Add note" button)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "sales-pipe".notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id uuid NOT NULL REFERENCES "sales-pipe".opportunities(id) ON DELETE CASCADE,
    body text NOT NULL CHECK (length(trim(body)) > 0),
    created_by uuid REFERENCES "sales-pipe".profiles(id),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notes_opp ON "sales-pipe".notes(opportunity_id, created_at DESC);
ALTER TABLE "sales-pipe".notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Notes read" ON "sales-pipe".notes;
CREATE POLICY "Notes read" ON "sales-pipe".notes FOR SELECT
    USING (EXISTS (SELECT 1 FROM "sales-pipe".opportunities o WHERE o.id = opportunity_id));
REVOKE ALL ON "sales-pipe".notes FROM anon, public;
GRANT SELECT ON "sales-pipe".notes TO authenticated;
GRANT ALL ON "sales-pipe".notes TO service_role;

-- Helpful indexes for the lists
CREATE INDEX IF NOT EXISTS idx_bus_name_lower ON "sales-pipe".businesses (lower(business_name));
CREATE INDEX IF NOT EXISTS idx_bus_type ON "sales-pipe".businesses (business_type);
CREATE INDEX IF NOT EXISTS idx_threads_opp ON "sales-pipe".threads (opportunity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON "sales-pipe".notifications (user_id, is_read, created_at DESC);

-- ------------------------------------------------------------------------------
-- 2. Fixed lists (kept in one place for validation)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".type_category(p_type text)
RETURNS text AS $$
    SELECT CASE
        WHEN p_type IN ('Cafe', 'Restaurant', 'Bakery', 'Takeaway', 'Pub / Bar') THEN 'Food & Drink'
        WHEN p_type IN ('Hotel', 'Boutique hotel', 'B&B / Guesthouse', 'Short-let / Airbnb host', 'Serviced apartments', 'Hostel') THEN 'Accommodation'
        WHEN p_type IN ('Hair salon', 'Barber', 'Beauty', 'Nails & Lashes', 'Medical aesthetics', 'Spa', 'Fitness / Training studio') THEN 'Beauty & Wellness'
        WHEN p_type IN ('Fashion boutique', 'Florist', 'Other') THEN 'Retail & Other'
        ELSE NULL END
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION "sales-pipe".valid_services()
RETURNS text[] AS $$
    SELECT ARRAY['Website', 'Micro Automation', 'End-to-End Automation', 'Custom Dashboard', 'Cold Outreach']
$$ LANGUAGE sql IMMUTABLE;

-- Instagram / Facebook: keep just the handle or page name
CREATE OR REPLACE FUNCTION "sales-pipe".clean_handle(p text)
RETURNS text AS $$
    SELECT nullif(trim(both '/@ ' FROM regexp_replace(
        regexp_replace(coalesce(p, ''), '^\s*(https?://)?(www\.|m\.)?(instagram\.com|facebook\.com|fb\.com)/', '', 'i'),
        '[?#].*$', '')), '')
$$ LANGUAGE sql IMMUTABLE;

-- ------------------------------------------------------------------------------
-- 3. Access check, now with the hand-over rule: once a consultant is assigned,
--    the salesperson can read but not change the pitch.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".check_opp_access(p_opportunity_id uuid)
RETURNS void AS $$
DECLARE
    v_opp record;
    v_role text;
BEGIN
    IF auth.role() = 'service_role' THEN RETURN; END IF;
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not logged in'; END IF;
    v_role := "sales-pipe".get_user_role();
    IF v_role IS NULL THEN RAISE EXCEPTION 'Your account is not set up'; END IF;
    IF v_role = 'admin' THEN RETURN; END IF;

    SELECT * INTO v_opp FROM "sales-pipe".opportunities WHERE id = p_opportunity_id;
    IF v_opp.id IS NULL THEN RAISE EXCEPTION 'Pitch not found'; END IF;

    IF auth.uid() = v_opp.assigned_consultant_id THEN RETURN; END IF;

    IF auth.uid() = v_opp.assigned_sales_id THEN
        IF v_opp.assigned_consultant_id IS NOT NULL AND v_opp.stage = 'Consultation' THEN
            RAISE EXCEPTION 'This business has been handed over to a consultant';
        END IF;
        RETURN;
    END IF;

    IF v_role = 'sales' AND v_opp.assigned_sales_id IS NULL AND v_opp.assigned_consultant_id IS NULL THEN
        RETURN; -- unassigned (review queue)
    END IF;

    RAISE EXCEPTION 'You are not assigned to this business';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

CREATE OR REPLACE FUNCTION "sales-pipe".require_role(p_roles text[])
RETURNS void AS $$
BEGIN
    IF auth.role() = 'service_role' THEN RETURN; END IF;
    IF coalesce("sales-pipe".get_user_role(), '') <> ALL (p_roles) THEN
        RAISE EXCEPTION 'You do not have permission to do this';
    END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

-- ------------------------------------------------------------------------------
-- 4. Record a sent message (adds: never send to opted-out businesses)
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
BEGIN
    SELECT * INTO v_thread FROM "sales-pipe".threads WHERE id = p_thread_id;
    IF v_thread.id IS NULL THEN RAISE EXCEPTION 'Thread not found'; END IF;
    SELECT * INTO v_opp FROM "sales-pipe".opportunities WHERE id = v_thread.opportunity_id;

    PERFORM "sales-pipe".check_opp_access(v_opp.id);

    IF v_opp.stage = 'Do not contact' OR v_thread.status = 'Opted out' THEN
        RAISE EXCEPTION 'This business asked not to be contacted';
    END IF;
    IF coalesce(trim(p_body), '') = '' THEN
        RAISE EXCEPTION 'The message is empty';
    END IF;

    v_new_step := least(v_thread.step + 1, 4);
    SELECT days_delay INTO v_days FROM "sales-pipe".cadence_rules
    WHERE step_name = CASE v_new_step WHEN 1 THEN 'Follow up 1' WHEN 2 THEN 'Follow up 2' WHEN 3 THEN 'Follow up 3' END;
    v_days := CASE WHEN v_new_step < 4 THEN coalesce(v_days, CASE v_new_step WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 14 END) END;

    -- A reply to their message is not a cadence step
    IF v_thread.status = 'Replied' THEN
        INSERT INTO "sales-pipe".messages (thread_id, direction, body, subject, template_id, step_label, send_method, external_message_id, sent_by, delivery_status)
        VALUES (p_thread_id, 'outbound', p_body, p_subject, p_template_id, 'Reply', p_send_method, p_external_message_id, coalesce(p_sent_by, auth.uid()), 'sent');
        UPDATE "sales-pipe".threads SET last_outbound_at = now() WHERE id = p_thread_id;
        UPDATE "sales-pipe".drafts SET status = 'sent' WHERE thread_id = p_thread_id AND status IN ('ready', 'needs_data');
        RETURN;
    END IF;

    INSERT INTO "sales-pipe".messages (thread_id, direction, body, subject, template_id, step_label, send_method, external_message_id, sent_by, delivery_status)
    VALUES (
        p_thread_id, 'outbound', p_body, p_subject, p_template_id,
        CASE v_thread.step WHEN 0 THEN 'First contact' WHEN 1 THEN 'Follow-up 1' WHEN 2 THEN 'Follow-up 2' ELSE 'Final check' END,
        p_send_method, p_external_message_id, coalesce(p_sent_by, auth.uid()), 'sent'
    );

    UPDATE "sales-pipe".threads
    SET step = v_new_step,
        status = 'Awaiting reply',
        paused_reason = NULL,
        next_due_on = CASE WHEN v_days IS NULL
                           THEN "sales-pipe".add_working_days(CURRENT_DATE, 14)  -- after the final check: wait, then No reply
                           ELSE "sales-pipe".add_working_days(CURRENT_DATE, v_days) END,
        last_outbound_at = now()
    WHERE id = p_thread_id;

    UPDATE "sales-pipe".drafts SET status = 'sent'
    WHERE thread_id = p_thread_id AND status IN ('ready', 'needs_data');

    IF v_opp.stage = 'Needs review' THEN
        UPDATE "sales-pipe".opportunities SET stage = 'Active' WHERE id = v_opp.id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

-- The daily update must not draft again after the final check
CREATE OR REPLACE FUNCTION "sales-pipe".daily_update()
RETURNS void AS $$
DECLARE
    t record;
    o record;
BEGIN
    FOR t IN
        SELECT th.id, th.step FROM "sales-pipe".threads th
        JOIN "sales-pipe".opportunities op ON op.id = th.opportunity_id
        JOIN "sales-pipe".businesses b ON b.id = op.business_id
        WHERE th.next_due_on <= CURRENT_DATE AND th.step < 4
          AND th.status IN ('Not contacted', 'Awaiting reply')
          AND op.stage IN ('Active', 'Interested')
          AND NOT b.archived
    LOOP
        PERFORM "sales-pipe".generate_draft(t.id,
            CASE t.step WHEN 0 THEN 'First contact' WHEN 1 THEN 'Follow-up 1' WHEN 2 THEN 'Follow-up 2' ELSE 'Final check' END);
    END LOOP;

    -- Final check sent, no reply after 14 working days
    UPDATE "sales-pipe".threads
    SET status = 'No reply', next_due_on = NULL
    WHERE step = 4 AND status = 'Awaiting reply'
      AND "sales-pipe".add_working_days(last_outbound_at::date, 14) <= CURRENT_DATE;

    UPDATE "sales-pipe".opportunities op
    SET stage = 'No response', closed_at = now()
    WHERE op.stage = 'Active'
      AND EXISTS (SELECT 1 FROM "sales-pipe".threads th WHERE th.opportunity_id = op.id AND th.step > 0)
      AND NOT EXISTS (SELECT 1 FROM "sales-pipe".threads th WHERE th.opportunity_id = op.id AND th.step > 0 AND th.status <> 'No reply')
      AND NOT EXISTS (SELECT 1 FROM "sales-pipe".threads th WHERE th.opportunity_id = op.id AND th.last_inbound_at IS NOT NULL);

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
-- 5. Duplicate check for imports and the Add business form
--    p_rows: [{ "idx": 0, "business_name": "...", "phone": "...", "email": "...", "postcode": "..." }, ...]
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".find_duplicates(p_rows jsonb)
RETURNS TABLE (idx int, business_id uuid, business_name text, matched_by text, open_pitches int) AS $$
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales']);
    RETURN QUERY
    WITH r AS (
        SELECT (x->>'idx')::int AS idx,
               lower(trim(x->>'business_name')) AS name,
               "sales-pipe".normalise_phone(x->>'phone') AS phone,
               "sales-pipe".normalise_email(x->>'email') AS email,
               upper(regexp_replace(coalesce(x->>'postcode', ''), '\s', '', 'g')) AS pc
        FROM jsonb_array_elements(p_rows) x
    )
    SELECT DISTINCT ON (r.idx) r.idx, b.id, b.business_name,
           CASE WHEN r.phone IS NOT NULL AND b.phone_normalised = r.phone THEN 'phone'
                WHEN r.email IS NOT NULL AND b.email_normalised = r.email THEN 'email'
                ELSE 'name and postcode' END,
           (SELECT count(*)::int FROM "sales-pipe".opportunities o
             WHERE o.business_id = b.id AND o.stage NOT IN ('Won', 'Declined', 'Do not contact', 'No response', 'Went cold'))
    FROM r
    JOIN "sales-pipe".businesses b ON
         (r.phone IS NOT NULL AND b.phone_normalised = r.phone)
      OR (r.email IS NOT NULL AND b.email_normalised = r.email)
      OR (r.pc <> '' AND lower(b.business_name) = r.name
          AND upper(regexp_replace(coalesce(b.postcode, ''), '\s', '', 'g')) = r.pc)
    ORDER BY r.idx;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

-- ------------------------------------------------------------------------------
-- 6. Import businesses (CSV import and Add business). One bad row never stops
--    the rest. Each row: { "action": "new" | "update" | "new_pitch" | "skip",
--    "existing_id": uuid (for update / new_pitch), "services": [...], fields... }
--    Returns { created, updated, pitches, skipped, failed, errors: [{ idx, message }] }
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".import_businesses(p_rows jsonb)
RETURNS jsonb AS $$
DECLARE
    x jsonb;
    v_action text;
    v_bid uuid;
    v_services text[];
    v_type text;
    v_created int := 0; v_updated int := 0; v_pitches int := 0; v_skipped int := 0; v_failed int := 0;
    v_errors jsonb := '[]'::jsonb;
    v_idx int;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales']);

    IF jsonb_array_length(p_rows) > 2000 THEN
        RAISE EXCEPTION 'Send at most 2,000 rows at a time';
    END IF;

    FOR x IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
        v_idx := coalesce((x->>'idx')::int, v_created + v_updated + v_pitches + v_skipped + v_failed);
        v_action := coalesce(x->>'action', 'new');
        BEGIN
            IF v_action = 'skip' THEN
                v_skipped := v_skipped + 1;
                CONTINUE;
            END IF;

            SELECT coalesce(array_agg(DISTINCT trim(s)) FILTER (WHERE trim(s) <> ''), '{}')
              INTO v_services
              FROM jsonb_array_elements_text(coalesce(x->'services', '[]'::jsonb)) s;
            IF array_length(v_services, 1) IS NULL AND v_action IN ('new', 'new_pitch') THEN
                RAISE EXCEPTION 'Pick at least one service to pitch';
            END IF;
            IF NOT (v_services <@ "sales-pipe".valid_services()) THEN
                RAISE EXCEPTION 'Unknown service: %', array_to_string(v_services, ', ');
            END IF;

            v_type := nullif(trim(x->>'business_type'), '');
            IF v_type IS NOT NULL AND "sales-pipe".type_category(v_type) IS NULL THEN
                RAISE EXCEPTION 'Unknown business type: %', v_type;
            END IF;

            IF v_action = 'new' THEN
                IF coalesce(trim(x->>'business_name'), '') = '' THEN RAISE EXCEPTION 'Business name is missing'; END IF;
                IF v_type IS NULL THEN RAISE EXCEPTION 'Business type is missing'; END IF;

                INSERT INTO "sales-pipe".businesses (
                    business_name, business_type, category, tier, room_count, area, address, postcode, maps_link,
                    google_rating, google_reviews_count, phone, whatsapp_number, email, instagram, facebook,
                    existing_website, company_type, contact_name, notes)
                VALUES (
                    trim(x->>'business_name'), v_type, "sales-pipe".type_category(v_type),
                    nullif(x->>'tier', ''), nullif(x->>'room_count', '')::int,
                    nullif(trim(x->>'area'), ''), nullif(trim(x->>'address'), ''), upper(nullif(trim(x->>'postcode'), '')),
                    nullif(trim(x->>'maps_link'), ''),
                    nullif(x->>'google_rating', '')::numeric, nullif(regexp_replace(coalesce(x->>'google_reviews_count', ''), '\D', '', 'g'), '')::int,
                    nullif(trim(x->>'phone'), ''), nullif(trim(x->>'whatsapp_number'), ''),
                    nullif(lower(trim(x->>'email')), ''),
                    "sales-pipe".clean_handle(x->>'instagram'), "sales-pipe".clean_handle(x->>'facebook'),
                    nullif(trim(x->>'existing_website'), ''),
                    coalesce(nullif(x->>'company_type', ''), 'Unknown'),
                    nullif(trim(x->>'contact_name'), ''), nullif(trim(x->>'notes'), ''))
                RETURNING id INTO v_bid;
                v_created := v_created + 1;

            ELSIF v_action IN ('update', 'new_pitch') THEN
                v_bid := nullif(x->>'existing_id', '')::uuid;
                IF v_bid IS NULL OR NOT EXISTS (SELECT 1 FROM "sales-pipe".businesses WHERE id = v_bid) THEN
                    RAISE EXCEPTION 'The existing business was not found';
                END IF;
                IF v_action = 'update' THEN
                    -- Fill in or replace only the details provided
                    UPDATE "sales-pipe".businesses b SET
                        business_type = coalesce(v_type, b.business_type),
                        category = coalesce("sales-pipe".type_category(v_type), b.category),
                        tier = coalesce(nullif(x->>'tier', ''), b.tier),
                        room_count = coalesce(nullif(x->>'room_count', '')::int, b.room_count),
                        area = coalesce(nullif(trim(x->>'area'), ''), b.area),
                        address = coalesce(nullif(trim(x->>'address'), ''), b.address),
                        postcode = coalesce(upper(nullif(trim(x->>'postcode'), '')), b.postcode),
                        maps_link = coalesce(nullif(trim(x->>'maps_link'), ''), b.maps_link),
                        google_rating = coalesce(nullif(x->>'google_rating', '')::numeric, b.google_rating),
                        phone = coalesce(nullif(trim(x->>'phone'), ''), b.phone),
                        whatsapp_number = coalesce(nullif(trim(x->>'whatsapp_number'), ''), b.whatsapp_number),
                        email = coalesce(nullif(lower(trim(x->>'email')), ''), b.email),
                        instagram = coalesce("sales-pipe".clean_handle(x->>'instagram'), b.instagram),
                        facebook = coalesce("sales-pipe".clean_handle(x->>'facebook'), b.facebook),
                        existing_website = coalesce(nullif(trim(x->>'existing_website'), ''), b.existing_website),
                        company_type = coalesce(nullif(x->>'company_type', ''), b.company_type),
                        contact_name = coalesce(nullif(trim(x->>'contact_name'), ''), b.contact_name),
                        notes = CASE WHEN nullif(trim(x->>'notes'), '') IS NULL THEN b.notes
                                     ELSE concat_ws(E'\n', b.notes, trim(x->>'notes')) END
                    WHERE b.id = v_bid;
                    v_updated := v_updated + 1;
                END IF;
            END IF;

            -- A pitch for new businesses, and for "Add new pitch"
            IF v_action IN ('new', 'new_pitch') THEN
                INSERT INTO "sales-pipe".opportunities (business_id, services_pitched, stage, demo_link)
                VALUES (v_bid, v_services, 'Needs review', nullif(trim(x->>'demo_link'), ''));
                IF v_action = 'new_pitch' THEN v_pitches := v_pitches + 1; END IF;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            v_failed := v_failed + 1;
            v_errors := v_errors || jsonb_build_object('idx', v_idx, 'message',
                CASE WHEN SQLSTATE = '23505' THEN 'A business with this phone or email already exists'
                     WHEN SQLSTATE = '22P02' THEN 'A number field has text in it (rating, reviews or rooms)'
                     ELSE SQLERRM END);
        END;
    END LOOP;

    RETURN jsonb_build_object('created', v_created, 'updated', v_updated, 'pitches', v_pitches,
                              'skipped', v_skipped, 'failed', v_failed, 'errors', v_errors);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

-- ------------------------------------------------------------------------------
-- 7. Approve from the review queue: same as before, plus a role check and a
--    clear error when a lead has no way to be contacted.
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
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales']);

    FOR b IN SELECT * FROM "sales-pipe".businesses WHERE id = ANY(p_business_ids) AND NOT archived LOOP
        FOR opp IN SELECT * FROM "sales-pipe".opportunities WHERE business_id = b.id AND stage = 'Needs review' LOOP
            PERFORM "sales-pipe".check_opp_access(opp.id);

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
            IF array_length(platforms, 1) IS NULL THEN
                IF b.address IS NULL AND b.postcode IS NULL THEN
                    RAISE EXCEPTION '% has no phone, email, socials or address. Add one before approving.', b.business_name;
                END IF;
                platforms := ARRAY['Walk-in'];
            END IF;

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
-- 8. Small actions from the business page
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".add_note(p_opportunity_id uuid, p_body text)
RETURNS uuid AS $$
DECLARE v_id uuid;
BEGIN
    PERFORM "sales-pipe".check_opp_access(p_opportunity_id);
    IF coalesce(trim(p_body), '') = '' THEN RAISE EXCEPTION 'The note is empty'; END IF;
    INSERT INTO "sales-pipe".notes (opportunity_id, body, created_by)
    VALUES (p_opportunity_id, trim(p_body), auth.uid()) RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

-- Start outreach on another platform (e.g. Email added later)
CREATE OR REPLACE FUNCTION "sales-pipe".start_thread(p_opportunity_id uuid, p_platform text)
RETURNS uuid AS $$
DECLARE
    v_id uuid;
    v_opp record;
BEGIN
    PERFORM "sales-pipe".check_opp_access(p_opportunity_id);
    SELECT * INTO v_opp FROM "sales-pipe".opportunities WHERE id = p_opportunity_id;
    IF v_opp.stage = 'Do not contact' THEN RAISE EXCEPTION 'This business asked not to be contacted'; END IF;
    IF v_opp.stage = 'Needs review' THEN RAISE EXCEPTION 'Approve this lead first'; END IF;

    SELECT id INTO v_id FROM "sales-pipe".threads WHERE opportunity_id = p_opportunity_id AND platform = p_platform;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;

    INSERT INTO "sales-pipe".threads (opportunity_id, platform, status, step, next_due_on)
    VALUES (p_opportunity_id, p_platform, 'Not contacted', 0, CURRENT_DATE)
    RETURNING id INTO v_id;
    PERFORM "sales-pipe".generate_draft(v_id, 'First contact');
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

-- Pitch another service to an existing business
CREATE OR REPLACE FUNCTION "sales-pipe".new_pitch(p_business_id uuid, p_services text[], p_source_opportunity_id uuid DEFAULT NULL)
RETURNS uuid AS $$
DECLARE v_id uuid;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales', 'consultant']);
    IF p_services IS NULL OR array_length(p_services, 1) IS NULL THEN RAISE EXCEPTION 'Pick at least one service'; END IF;
    IF NOT (p_services <@ "sales-pipe".valid_services()) THEN RAISE EXCEPTION 'Unknown service'; END IF;
    INSERT INTO "sales-pipe".opportunities (business_id, services_pitched, stage, source_opportunity_id, assigned_sales_id)
    VALUES (p_business_id, p_services, 'Needs review', p_source_opportunity_id,
            CASE WHEN "sales-pipe".get_user_role() = 'sales' THEN auth.uid() END)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;


-- ------------------------------------------------------------------------------
-- 8b. Old drafts must not linger: when they reply, when handed over, or when a
--     pitch is closed, open drafts on that pitch are discarded.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".discard_drafts(p_opportunity_id uuid)
RETURNS void AS $$
    UPDATE "sales-pipe".drafts d SET status = 'discarded'
    FROM "sales-pipe".threads t
    WHERE d.thread_id = t.id AND t.opportunity_id = p_opportunity_id AND d.status IN ('ready', 'needs_data')
$$ LANGUAGE sql SECURITY DEFINER SET search_path = "sales-pipe", public;

CREATE OR REPLACE FUNCTION "sales-pipe".trg_opp_stage_cleanup()
RETURNS trigger AS $$
BEGIN
    IF NEW.stage IS DISTINCT FROM OLD.stage
       AND NEW.stage IN ('Consultation', 'Won', 'Declined', 'Do not contact', 'No response', 'Went cold') THEN
        PERFORM "sales-pipe".discard_drafts(NEW.id);
        UPDATE "sales-pipe".threads SET next_due_on = NULL
        WHERE opportunity_id = NEW.id AND status IN ('Not contacted', 'Awaiting reply');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

DROP TRIGGER IF EXISTS trg_opp_stage_cleanup ON "sales-pipe".opportunities;
CREATE TRIGGER trg_opp_stage_cleanup AFTER UPDATE OF stage ON "sales-pipe".opportunities
    FOR EACH ROW EXECUTE FUNCTION "sales-pipe".trg_opp_stage_cleanup();

-- Inbound (n8n only): same as file 22, but discards every open draft on the pitch
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
               OR "sales-pipe".normalise_phone(b.whatsapp_number) = "sales-pipe".normalise_phone(p_from)
               OR b.email_normalised = "sales-pipe".normalise_email(p_from)
               OR lower(b.instagram) = lower(trim(both '@' FROM p_from))
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

    PERFORM "sales-pipe".discard_drafts(v_opp_id);

    IF upper(trim(p_body)) IN ('STOP', 'STOP.', 'UNSUBSCRIBE') THEN
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
-- 9. Admin bulk actions (Lead Management). No bulk messaging, by design.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".assign_sales(p_opportunity_ids uuid[], p_sales_id uuid)
RETURNS int AS $$
DECLARE v_count int;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin']);
    IF p_sales_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM "sales-pipe".profiles WHERE id = p_sales_id AND role IN ('sales', 'admin') AND is_active) THEN
        RAISE EXCEPTION 'Pick an active salesperson';
    END IF;
    UPDATE "sales-pipe".opportunities SET assigned_sales_id = p_sales_id WHERE id = ANY(p_opportunity_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF p_sales_id IS NOT NULL AND v_count > 0 AND p_sales_id <> auth.uid() THEN
        INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
        VALUES (p_sales_id, 'assigned_to_you', v_count || ' business(es) assigned to you', '/dashboard/leads');
    END IF;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

CREATE OR REPLACE FUNCTION "sales-pipe".set_services(p_opportunity_ids uuid[], p_services text[])
RETURNS int AS $$
DECLARE
    o record;
    v_count int := 0;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin']);
    IF p_services IS NULL OR array_length(p_services, 1) IS NULL THEN RAISE EXCEPTION 'Pick at least one service'; END IF;
    IF NOT (p_services <@ "sales-pipe".valid_services()) THEN RAISE EXCEPTION 'Unknown service'; END IF;
    FOR o IN SELECT * FROM "sales-pipe".opportunities WHERE id = ANY(p_opportunity_ids) LOOP
        IF o.services_pitched IS DISTINCT FROM p_services THEN
            UPDATE "sales-pipe".opportunities SET services_pitched = p_services WHERE id = o.id;
            INSERT INTO "sales-pipe".stage_changes (opportunity_id, from_stage, to_stage, from_services, to_services, reason, changed_by)
            VALUES (o.id, o.stage, o.stage, o.services_pitched, p_services, 'Services pitched changed', auth.uid());
            v_count := v_count + 1;
        END IF;
    END LOOP;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

CREATE OR REPLACE FUNCTION "sales-pipe".set_archived(p_business_ids uuid[], p_archived boolean)
RETURNS int AS $$
DECLARE v_count int;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin']);
    UPDATE "sales-pipe".businesses SET archived = p_archived WHERE id = ANY(p_business_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF p_archived THEN
        UPDATE "sales-pipe".threads t SET next_due_on = NULL
        FROM "sales-pipe".opportunities o
        WHERE o.id = t.opportunity_id AND o.business_id = ANY(p_business_ids);
        UPDATE "sales-pipe".drafts d SET status = 'discarded'
        FROM "sales-pipe".threads t JOIN "sales-pipe".opportunities o ON o.id = t.opportunity_id
        WHERE d.thread_id = t.id AND o.business_id = ANY(p_business_ids) AND d.status IN ('ready', 'needs_data');
    END IF;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

-- ------------------------------------------------------------------------------
-- 10. One list function for every list screen (business cards, status pages,
--     Lead Management, review queue). Scoped by role, paged, with total count.
--     p_filter: 'all' | 'needs-reply' | 'needs-consultant' | 'open' | a stage name
--     p_assigned: NULL (anyone) | 'me' | 'unassigned' | a profile id
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS "sales-pipe".list_pitches(text, text, text, text, text, text, boolean, int, int);
CREATE OR REPLACE FUNCTION "sales-pipe".list_pitches(
    p_service text DEFAULT NULL,
    p_type text DEFAULT NULL,
    p_filter text DEFAULT 'all',
    p_search text DEFAULT NULL,
    p_platform text DEFAULT NULL,
    p_assigned text DEFAULT NULL,
    p_include_archived boolean DEFAULT false,
    p_limit int DEFAULT 24,
    p_offset int DEFAULT 0
)
RETURNS TABLE (
    opportunity_id uuid,
    business_id uuid,
    business_name text,
    business_type text,
    area text,
    postcode text,
    address text,
    google_rating numeric,
    phone text,
    email text,
    instagram text,
    facebook text,
    company_type text,
    contact_name text,
    archived boolean,
    stage text,
    services_pitched text[],
    services_won text[],
    assigned_sales_id uuid,
    assigned_sales_name text,
    assigned_consultant_name text,
    consultation_at timestamptz,
    created_at timestamptz,
    threads jsonb,
    next_due_on date,
    needs_reply boolean,
    total_count bigint
) AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
BEGIN
    IF v_role IS NULL AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Your account is not set up';
    END IF;

    RETURN QUERY
    WITH base AS (
        SELECT o.*, b.business_name AS b_name, b.business_type AS b_type, b.area AS b_area, b.postcode AS b_pc,
               b.address AS b_address, b.google_rating AS b_rating, b.phone AS b_phone, b.email AS b_email,
               b.instagram AS b_ig, b.facebook AS b_fb, b.company_type AS b_ct, b.contact_name AS b_contact,
               b.archived AS b_archived,
               EXISTS (SELECT 1 FROM "sales-pipe".threads t
                        WHERE t.opportunity_id = o.id AND t.status = 'Replied'
                          AND t.last_inbound_at > coalesce(t.last_outbound_at, '-infinity'))
               AND o.stage IN ('Active', 'Interested', 'Consultation') AS b_needs_reply
        FROM "sales-pipe".opportunities o
        JOIN "sales-pipe".businesses b ON b.id = o.business_id
        WHERE (p_include_archived OR NOT b.archived)
          AND (v_role = 'admin' OR auth.role() = 'service_role'
               OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
               OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
          AND (nullif(p_service, '') IS NULL OR p_service = ANY(o.services_pitched))
          AND (nullif(p_type, '') IS NULL OR b.business_type = p_type)
          AND (nullif(p_search, '') IS NULL
               OR b.business_name ILIKE '%' || p_search || '%'
               OR b.area ILIKE '%' || p_search || '%'
               OR b.postcode ILIKE '%' || p_search || '%'
               OR b.phone_normalised = "sales-pipe".normalise_phone(p_search)
               OR b.email ILIKE '%' || p_search || '%')
          AND (nullif(p_platform, '') IS NULL OR EXISTS (
               SELECT 1 FROM "sales-pipe".threads t WHERE t.opportunity_id = o.id AND t.platform = p_platform))
          AND (nullif(p_assigned, '') IS NULL
               OR (p_assigned = 'me' AND (o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid))
               OR (p_assigned = 'unassigned' AND o.assigned_sales_id IS NULL)
               OR (p_assigned NOT IN ('me', 'unassigned') AND (o.assigned_sales_id::text = p_assigned OR o.assigned_consultant_id::text = p_assigned)))
    ),
    filtered AS (
        SELECT * FROM base
        WHERE coalesce(p_filter, 'all') = 'all'
           OR (p_filter = 'needs-reply' AND base.b_needs_reply)
           OR (p_filter = 'needs-consultant' AND base.stage = 'Consultation' AND base.assigned_consultant_id IS NULL)
           OR (p_filter = 'open' AND base.stage IN ('Active', 'Interested', 'Consultation'))
           OR base.stage = p_filter
    )
    SELECT f.id, f.business_id, f.b_name, f.b_type, f.b_area, f.b_pc, f.b_address, f.b_rating, f.b_phone, f.b_email,
           f.b_ig, f.b_fb, f.b_ct, f.b_contact, f.b_archived, f.stage, f.services_pitched, f.services_won,
           f.assigned_sales_id,
           (SELECT full_name FROM "sales-pipe".profiles WHERE id = f.assigned_sales_id),
           (SELECT full_name FROM "sales-pipe".profiles WHERE id = f.assigned_consultant_id),
           f.consultation_at, f.created_at,
           coalesce((SELECT jsonb_agg(jsonb_build_object(
                        'id', t.id, 'platform', t.platform, 'status', t.status, 'step', t.step,
                        'next_due_on', t.next_due_on, 'paused_reason', t.paused_reason)
                      ORDER BY array_position(ARRAY['WhatsApp','Instagram','Facebook','Email','Phone','Walk-in'], t.platform))
                     FROM "sales-pipe".threads t WHERE t.opportunity_id = f.id), '[]'::jsonb),
           (SELECT min(t.next_due_on) FROM "sales-pipe".threads t
             WHERE t.opportunity_id = f.id AND t.status IN ('Not contacted', 'Awaiting reply')),
           f.b_needs_reply,
           count(*) OVER ()
    FROM filtered f
    ORDER BY f.b_needs_reply DESC,
             (SELECT min(t.next_due_on) FROM "sales-pipe".threads t
               WHERE t.opportunity_id = f.id AND t.status IN ('Not contacted', 'Awaiting reply')) ASC NULLS LAST,
             f.created_at DESC
    LIMIT least(coalesce(p_limit, 24), 500) OFFSET greatest(coalesce(p_offset, 0), 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

-- ------------------------------------------------------------------------------
-- 11. Counts for the home page and drill-down (archived businesses excluded,
--     "replies" = replies still waiting for us)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS "sales-pipe".v_dashboard_status_counts(uuid);
CREATE FUNCTION "sales-pipe".v_dashboard_status_counts(p_user uuid)
RETURNS TABLE (
    needs_reply bigint, interested bigint, consultation bigint, went_cold bigint, no_response bigint,
    needs_consultant bigint, unmatched_bookings bigint, needs_review bigint, total_pitches bigint
) AS $$
DECLARE
    v_role text;
BEGIN
    -- Only your own numbers (admins can ask for anyone)
    IF auth.role() <> 'service_role' AND p_user IS DISTINCT FROM auth.uid()
       AND coalesce("sales-pipe".get_user_role(), '') <> 'admin' THEN
        RAISE EXCEPTION 'You can only see your own numbers';
    END IF;
    SELECT role INTO v_role FROM "sales-pipe".profiles WHERE id = p_user;

    RETURN QUERY
    WITH mine AS (
        SELECT o.* FROM "sales-pipe".opportunities o
        JOIN "sales-pipe".businesses b ON b.id = o.business_id AND NOT b.archived
        WHERE v_role = 'admin' OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user
           OR (v_role = 'sales' AND o.stage = 'Needs review' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
    )
    SELECT
        (SELECT count(DISTINCT m.id) FROM mine m JOIN "sales-pipe".threads t ON t.opportunity_id = m.id
          WHERE m.stage IN ('Active', 'Interested', 'Consultation') AND t.status = 'Replied'
            AND t.last_inbound_at > coalesce(t.last_outbound_at, '-infinity')),
        (SELECT count(*) FROM mine WHERE stage = 'Interested'),
        (SELECT count(*) FROM mine WHERE stage = 'Consultation'),
        (SELECT count(*) FROM mine WHERE stage = 'Went cold'),
        (SELECT count(*) FROM mine WHERE stage = 'No response'),
        (CASE WHEN v_role = 'admin' THEN (SELECT count(*) FROM mine WHERE stage = 'Consultation' AND assigned_consultant_id IS NULL) ELSE 0 END),
        (CASE WHEN v_role = 'admin' THEN (SELECT count(*) FROM "sales-pipe".consultation_bookings WHERE match_status = 'unmatched') ELSE 0 END),
        (SELECT count(*) FROM mine WHERE stage = 'Needs review'),
        (SELECT count(*) FROM mine);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

DROP FUNCTION IF EXISTS "sales-pipe".v_service_counts(uuid);
CREATE FUNCTION "sales-pipe".v_service_counts(p_user uuid)
RETURNS TABLE (service_name text, businesses_count bigint, replies_count bigint, active_count bigint, won_count bigint) AS $$
DECLARE
    v_role text;
BEGIN
    IF auth.role() <> 'service_role' AND p_user IS DISTINCT FROM auth.uid()
       AND coalesce("sales-pipe".get_user_role(), '') <> 'admin' THEN
        RAISE EXCEPTION 'You can only see your own numbers';
    END IF;
    SELECT role INTO v_role FROM "sales-pipe".profiles WHERE id = p_user;

    RETURN QUERY
    SELECT s.srv,
        count(DISTINCT o.business_id),
        count(DISTINCT o.id) FILTER (WHERE o.stage IN ('Active', 'Interested', 'Consultation') AND EXISTS (
            SELECT 1 FROM "sales-pipe".threads t WHERE t.opportunity_id = o.id AND t.status = 'Replied'
              AND t.last_inbound_at > coalesce(t.last_outbound_at, '-infinity'))),
        count(DISTINCT o.id) FILTER (WHERE o.stage IN ('Active', 'Interested', 'Consultation')),
        count(DISTINCT o.id) FILTER (WHERE o.stage = 'Won')
    FROM unnest("sales-pipe".valid_services()) WITH ORDINALITY AS s(srv, ord)
    LEFT JOIN ("sales-pipe".opportunities o JOIN "sales-pipe".businesses b ON b.id = o.business_id AND NOT b.archived)
        ON s.srv = ANY(o.services_pitched)
       AND (v_role = 'admin' OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user)
    GROUP BY s.srv, s.ord
    ORDER BY s.ord;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

CREATE OR REPLACE FUNCTION "sales-pipe".v_business_type_counts(p_service text, p_user uuid)
RETURNS TABLE (business_type text, businesses_count bigint, replies_count bigint, due_today_count bigint) AS $$
DECLARE
    v_role text;
BEGIN
    IF auth.role() <> 'service_role' AND p_user IS DISTINCT FROM auth.uid()
       AND coalesce("sales-pipe".get_user_role(), '') <> 'admin' THEN
        RAISE EXCEPTION 'You can only see your own numbers';
    END IF;
    SELECT role INTO v_role FROM "sales-pipe".profiles WHERE id = p_user;

    RETURN QUERY
    SELECT b.business_type,
        count(DISTINCT b.id),
        count(DISTINCT o.id) FILTER (WHERE o.stage IN ('Active', 'Interested', 'Consultation') AND EXISTS (
            SELECT 1 FROM "sales-pipe".threads t WHERE t.opportunity_id = o.id AND t.status = 'Replied'
              AND t.last_inbound_at > coalesce(t.last_outbound_at, '-infinity'))),
        count(DISTINCT o.id) FILTER (WHERE o.stage IN ('Active', 'Interested') AND EXISTS (
            SELECT 1 FROM "sales-pipe".threads t WHERE t.opportunity_id = o.id
              AND t.status IN ('Not contacted', 'Awaiting reply') AND t.next_due_on <= CURRENT_DATE))
    FROM "sales-pipe".opportunities o
    JOIN "sales-pipe".businesses b ON b.id = o.business_id AND NOT b.archived
    WHERE p_service = ANY(o.services_pitched)
      AND (v_role = 'admin' OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user
           OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
    GROUP BY b.business_type
    ORDER BY count(DISTINCT b.id) DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

DROP FUNCTION IF EXISTS "sales-pipe".v_due_today(text, int, int);
CREATE FUNCTION "sales-pipe".v_due_today(p_tab text, p_limit int DEFAULT 100, p_offset int DEFAULT 0)
RETURNS TABLE (
    thread_id uuid, opportunity_id uuid, business_name text, business_type text, platform text,
    step int, status text, next_due_on date, last_inbound_at timestamptz, draft_status text
) AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
BEGIN
    RETURN QUERY
    SELECT t.id, o.id, b.business_name, b.business_type, t.platform, t.step, t.status, t.next_due_on, t.last_inbound_at,
           (SELECT d.status FROM "sales-pipe".drafts d WHERE d.thread_id = t.id AND d.status IN ('ready', 'needs_data')
             ORDER BY d.created_at DESC LIMIT 1)
    FROM "sales-pipe".threads t
    JOIN "sales-pipe".opportunities o ON o.id = t.opportunity_id
    JOIN "sales-pipe".businesses b ON b.id = o.business_id AND NOT b.archived
    WHERE o.stage IN ('Active', 'Interested', 'Consultation')
      AND (v_role = 'admin' OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid)
      AND (
        (p_tab = 'New outreach' AND t.status = 'Not contacted' AND t.next_due_on <= current_date) OR
        (p_tab = 'Follow-ups'   AND t.status = 'Awaiting reply' AND t.next_due_on <= current_date AND t.step < 4) OR
        (p_tab = 'Replies'      AND t.status = 'Replied' AND t.last_inbound_at > coalesce(t.last_outbound_at, '-infinity'))
      )
    ORDER BY t.next_due_on ASC NULLS LAST, t.last_inbound_at ASC NULLS LAST
    LIMIT least(coalesce(p_limit, 100), 500) OFFSET greatest(coalesce(p_offset, 0), 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

-- Unmatched website bookings (admin)
CREATE OR REPLACE FUNCTION "sales-pipe".list_unmatched_bookings()
RETURNS SETOF "sales-pipe".consultation_bookings AS $$
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin']);
    RETURN QUERY SELECT * FROM "sales-pipe".consultation_bookings WHERE match_status = 'unmatched' ORDER BY booked_for;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

-- ------------------------------------------------------------------------------
-- 12. Live updates in the app (Supabase Realtime): new messages and notifications
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE "sales-pipe".messages;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE "sales-pipe".notifications;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 12b. Tighter table rules. All changes to threads, messages, drafts and the
--      audit go through the checked functions above, so staff only read them.
--      Businesses: read and edit only the ones you can see in your lists.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "sales-pipe".can_see_business(p_business_id uuid)
RETURNS boolean AS $$
    SELECT "sales-pipe".get_user_role() = 'admin'
        OR EXISTS (SELECT 1 FROM "sales-pipe".opportunities o
                   WHERE o.business_id = p_business_id
                     AND (o.assigned_sales_id = auth.uid() OR o.assigned_consultant_id = auth.uid()
                          OR ("sales-pipe".get_user_role() = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)))
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = "sales-pipe", public;

DROP POLICY IF EXISTS "Businesses read" ON "sales-pipe".businesses;
CREATE POLICY "Businesses read" ON "sales-pipe".businesses FOR SELECT USING ("sales-pipe".can_see_business(id));
DROP POLICY IF EXISTS "Businesses update" ON "sales-pipe".businesses;
CREATE POLICY "Businesses update" ON "sales-pipe".businesses FOR UPDATE
    USING ("sales-pipe".can_see_business(id)) WITH CHECK ("sales-pipe".can_see_business(id));
DROP POLICY IF EXISTS "Businesses insert" ON "sales-pipe".businesses;  -- new businesses come in through import_businesses

DROP POLICY IF EXISTS "Opportunities insert" ON "sales-pipe".opportunities;  -- through import_businesses / new_pitch
DROP POLICY IF EXISTS "Opportunities update" ON "sales-pipe".opportunities;  -- through set_stage, record_win and the rest

DROP POLICY IF EXISTS "Threads access" ON "sales-pipe".threads;
DROP POLICY IF EXISTS "Threads read" ON "sales-pipe".threads;
CREATE POLICY "Threads read" ON "sales-pipe".threads FOR SELECT
    USING (EXISTS (SELECT 1 FROM "sales-pipe".opportunities o WHERE o.id = opportunity_id));
DROP POLICY IF EXISTS "Messages access" ON "sales-pipe".messages;
DROP POLICY IF EXISTS "Messages read" ON "sales-pipe".messages;
CREATE POLICY "Messages read" ON "sales-pipe".messages FOR SELECT
    USING (EXISTS (SELECT 1 FROM "sales-pipe".threads t WHERE t.id = thread_id));
DROP POLICY IF EXISTS "Drafts access" ON "sales-pipe".drafts;
DROP POLICY IF EXISTS "Drafts read" ON "sales-pipe".drafts;
CREATE POLICY "Drafts read" ON "sales-pipe".drafts FOR SELECT
    USING (EXISTS (SELECT 1 FROM "sales-pipe".threads t WHERE t.id = thread_id));
DROP POLICY IF EXISTS "Stage_changes access" ON "sales-pipe".stage_changes;
DROP POLICY IF EXISTS "Stage changes read" ON "sales-pipe".stage_changes;
CREATE POLICY "Stage changes read" ON "sales-pipe".stage_changes FOR SELECT
    USING (EXISTS (SELECT 1 FROM "sales-pipe".opportunities o WHERE o.id = opportunity_id));

-- ------------------------------------------------------------------------------
-- 13. Who can call what
-- ------------------------------------------------------------------------------
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA "sales-pipe" FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "sales-pipe" TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA "sales-pipe" GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION "sales-pipe".record_inbound(text, text, text, text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION "sales-pipe".daily_update() FROM authenticated;

-- Staff can update their own notifications (mark as read) but not create them
REVOKE INSERT, DELETE ON "sales-pipe".notifications FROM authenticated;

NOTIFY pgrst, 'reload schema';


-- ==========================================
-- 24_v2_insights.sql
-- ==========================================

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


-- ==========================================
-- 25_v2_templates.sql
-- ==========================================

-- ==============================================================================
-- 25_v2_templates.sql
-- Templates screen: "All platforms" templates, one template per
-- step + service + platform, admin-only editing through functions,
-- and drafts that pick the most specific template. Safe to re-run. Run after 24.
--
-- Most specific wins (service first, then platform):
--   service + platform > service + All > General + platform > General + All
-- "All platforms" covers messaging only (WhatsApp, Instagram, Facebook, Email).
-- Phone and Walk-in always use their own call / visit notes.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

-- 1. Allow "All" (shown as "All platforms")
ALTER TABLE "sales-pipe".templates DROP CONSTRAINT IF EXISTS templates_platform_check;
ALTER TABLE "sales-pipe".templates ADD CONSTRAINT templates_platform_check
    CHECK (platform IN ('All', 'WhatsApp', 'Instagram', 'Facebook', 'Email', 'Phone', 'Walk-in'));

-- 2. Writes only through the functions below
DROP POLICY IF EXISTS "Templates write admin" ON "sales-pipe".templates;

-- 3. Template name, made from its slot
CREATE OR REPLACE FUNCTION "sales-pipe".template_name(p_step text, p_service text, p_platform text)
RETURNS text AS $$
    SELECT coalesce(nullif(p_service, ''), 'General') || ' · '
        || CASE WHEN p_platform = 'All' THEN 'All platforms' ELSE p_platform END || ' · ' || p_step;
$$ LANGUAGE sql IMMUTABLE;

-- 4. Create or edit (admin only). p_id NULL = new.
CREATE OR REPLACE FUNCTION "sales-pipe".save_template(
    p_id uuid,
    p_step text,
    p_service text,
    p_platform text,
    p_subject text,
    p_body text
) RETURNS uuid AS $$
DECLARE
    v_services text[];
    v_id uuid;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin']);

    IF coalesce(trim(p_body), '') = '' THEN RAISE EXCEPTION 'Write the message first'; END IF;

    IF p_id IS NOT NULL THEN
        SELECT step, coalesce(services[1], ''), platform INTO p_step, p_service, p_platform
        FROM "sales-pipe".templates WHERE id = p_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'Template not found'; END IF;
    END IF;

    IF p_step NOT IN ('First contact', 'Follow-up 1', 'Follow-up 2', 'Final check', 'Reply', 'Upsell') THEN
        RAISE EXCEPTION 'Unknown message type';
    END IF;
    IF p_platform NOT IN ('All', 'WhatsApp', 'Instagram', 'Facebook', 'Email', 'Phone', 'Walk-in') THEN
        RAISE EXCEPTION 'Unknown platform';
    END IF;
    IF nullif(p_service, '') IS NOT NULL AND NOT (p_service = ANY("sales-pipe".valid_services())) THEN
        RAISE EXCEPTION 'Unknown service';
    END IF;
    IF p_platform = 'Email' AND coalesce(trim(p_subject), '') = '' THEN
        RAISE EXCEPTION 'Email templates need a subject';
    END IF;

    v_services := CASE WHEN nullif(p_service, '') IS NULL THEN '{}'::text[] ELSE ARRAY[p_service] END;

    IF p_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM "sales-pipe".templates
                   WHERE step = p_step AND platform = p_platform AND services = v_services) THEN
            RAISE EXCEPTION 'There is already a template for %. Edit that one instead', "sales-pipe".template_name(p_step, p_service, p_platform);
        END IF;
        INSERT INTO "sales-pipe".templates (name, platform, step, services, subject, body, is_active)
        VALUES ("sales-pipe".template_name(p_step, p_service, p_platform), p_platform, p_step, v_services,
                CASE WHEN p_platform IN ('Email', 'All') THEN nullif(trim(p_subject), '') END, p_body, true)
        RETURNING id INTO v_id;
    ELSE
        UPDATE "sales-pipe".templates
        SET subject = CASE WHEN p_platform IN ('Email', 'All') THEN nullif(trim(p_subject), '') END,
            body = p_body,
            name = "sales-pipe".template_name(p_step, p_service, p_platform),
            updated_at = now()
        WHERE id = p_id
        RETURNING id INTO v_id;
    END IF;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

-- 5. On / Off (admin only). No delete, so history and Insights stay correct.
CREATE OR REPLACE FUNCTION "sales-pipe".set_template_active(p_id uuid, p_active boolean)
RETURNS void AS $$
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin']);
    UPDATE "sales-pipe".templates SET is_active = p_active, updated_at = now() WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Template not found'; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = "sales-pipe", public;

-- 6. Drafts: most specific template wins
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

    SELECT * INTO v_template
    FROM "sales-pipe".templates
    WHERE is_active = true
      AND (platform = v_thread.platform
           OR (platform = 'All' AND v_thread.platform IN ('WhatsApp', 'Instagram', 'Facebook', 'Email')))
      AND step = p_step
      AND (v_opp.services_pitched && services OR coalesce(array_length(services, 1), 0) = 0)
    ORDER BY
      CASE WHEN v_opp.services_pitched && services THEN 1 ELSE 2 END,
      CASE WHEN platform = v_thread.platform THEN 1 ELSE 2 END,
      CASE WHEN v_bus.business_type = ANY(business_types) THEN 1 ELSE 2 END,
      updated_at DESC
    LIMIT 1;

    IF v_template.id IS NULL THEN
        INSERT INTO "sales-pipe".drafts (thread_id, step_label, body, status, due_on, missing_fields)
        VALUES (p_thread_id, p_step, '', 'needs_data', CURRENT_DATE, ARRAY['template']);
        RETURN;
    END IF;

    v_body := v_template.body;
    -- "All platforms" templates only carry a subject for email threads
    v_subject := CASE WHEN v_thread.platform = 'Email' THEN v_template.subject END;

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

-- 7. Access
REVOKE EXECUTE ON FUNCTION "sales-pipe".save_template(uuid, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION "sales-pipe".set_template_active(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "sales-pipe".save_template(uuid, text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe".set_template_active(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe".template_name(text, text, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';


-- ==========================================
-- 26_v2_service_templates.sql
-- ==========================================

-- ==============================================================================
-- 26_v2_service_templates.sql
-- Message templates for Micro Automation, End-to-End Automation and
-- Custom Dashboard, a general Reply, and an Upsell for each service.
-- Run after 25. Safe to re-run: a template is only added if its
-- step + service + platform slot is empty, so edits made on the
-- Templates screen are never overwritten.
-- Clients are always described anonymously.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

INSERT INTO "sales-pipe".templates (name, platform, step, services, subject, body, is_active)
SELECT "sales-pipe".template_name(v.step, v.service, v.platform), v.platform, v.step,
       CASE WHEN v.service = '' THEN '{}'::text[] ELSE ARRAY[v.service] END,
       v.subject, v.body, true
FROM (VALUES

  -- ---------------- Micro Automation ----------------
  ('First contact', 'Micro Automation', 'All', NULL,
'Hi, I''m {sender_name} from Selfera. I came across {business_name} and wondered if there''s one job that eats up your team''s time, like answering the same booking questions or asking guests for reviews. We automate small jobs like that so they just happen. Would a quick example help?'),

  ('First contact', 'Micro Automation', 'Email', 'One less admin job for {business_name}',
'Hi {business_name} team,

I''m {sender_name} from Selfera. Most small hospitality teams have one or two jobs that take time every day, like answering the same booking questions, asking guests for reviews or chasing unpaid invoices.

We set up small automations that handle jobs like these in the background, using the tools you already have. Would it help if I sent a short example of how it could work at {business_name}?

{sender_name}
Selfera
Reply STOP and I won''t contact you again.'),

  -- ---------------- End-to-End Automation ----------------
  ('First contact', 'End-to-End Automation', 'All', NULL,
'Hi, I''m {sender_name} from Selfera. We help independent hospitality businesses save 10+ hours a week by connecting bookings, guest messages, marketing and reporting into one system, with a dedicated associate who looks after it for you. Would it be useful to see how this could work for {business_name}?'),

  ('First contact', 'End-to-End Automation', 'Email', 'Saving {business_name} 10+ hours a week',
'Hi {business_name} team,

I''m {sender_name} from Selfera. We connect the separate parts of a small business, such as bookings, guest messages, marketing and reporting, into one system that runs in the background. Owners we work with save 10+ hours a week.

For example, a five-branch London restaurant group we work with replaced spreadsheets and handwritten records with one connected system covering revenue, staffing and marketing. Every system comes with a dedicated Automation Associate who looks after it for you.

Would a short call to see if this fits {business_name} be useful?

{sender_name}
Selfera
Reply STOP and I won''t contact you again.'),

  -- ---------------- Custom Dashboard ----------------
  ('First contact', 'Custom Dashboard', 'All', NULL,
'Hi, I''m {sender_name} from Selfera. Many owners we speak to run their business from spreadsheets and notes. We build one simple dashboard that shows sales, bookings, staff and costs in one place. Could that help at {business_name}?'),

  ('First contact', 'Custom Dashboard', 'Email', '{business_name} in one simple dashboard',
'Hi {business_name} team,

I''m {sender_name} from Selfera. Many owners we speak to run their business from spreadsheets, notes and several different apps. We build one simple dashboard that shows sales, bookings, staff and costs in one place, updated automatically.

A five-branch London restaurant group we work with used to estimate their commission costs. Now they see every pound in and every fee out in one accurate view.

Could something like this help at {business_name}?

{sender_name}
Selfera
Reply STOP and I won''t contact you again.'),

  -- ---------------- Reply (any service) ----------------
  ('Reply', '', 'All', 'Next step for {business_name}',
'Thanks for getting back to me! The easiest next step is a short consultation, where we look at how {business_name} runs today and where automation would help most. You can pick a time here: https://www.selfera.co.uk/#booking'),

  -- ---------------- Upsell (after a win) ----------------
  ('Upsell', 'Website', 'All', 'One more idea for {business_name}',
'Hi, it''s {sender_name} from Selfera. Now your website is live, would you like enquiries from it answered automatically, so no booking gets missed? Happy to show you how.'),

  ('Upsell', 'Micro Automation', 'All', 'One more idea for {business_name}',
'Hi, it''s {sender_name} from Selfera. I hope the automation is saving you time. Is there another repeated job at {business_name} you''d like taken off your plate? Many owners go on to connect bookings, marketing and reporting into one system.'),

  ('Upsell', 'End-to-End Automation', 'All', 'One more idea for {business_name}',
'Hi, it''s {sender_name} from Selfera. Now everything is connected, would a simple dashboard showing sales, bookings and costs in one place be useful? It uses the data your system already collects.'),

  ('Upsell', 'Custom Dashboard', 'All', 'One more idea for {business_name}',
'Hi, it''s {sender_name} from Selfera. Now you can see your numbers in one place, would you like some of the jobs behind them automated too, like booking replies or invoice reminders?')

) AS v(step, service, platform, subject, body)
WHERE NOT EXISTS (
    SELECT 1 FROM "sales-pipe".templates t
    WHERE t.step = v.step AND t.platform = v.platform
      AND t.services = CASE WHEN v.service = '' THEN '{}'::text[] ELSE ARRAY[v.service] END
);

NOTIFY pgrst, 'reload schema';


