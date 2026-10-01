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
