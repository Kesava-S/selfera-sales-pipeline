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
