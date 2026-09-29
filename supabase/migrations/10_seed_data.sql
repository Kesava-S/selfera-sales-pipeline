-- ==============================================================================
-- 10_seed_data.sql
-- Initial seed leads and initial tasks for Today's queue
-- ==============================================================================

DO $$
DECLARE
    v_lead1_id uuid;
    v_lead2_id uuid;
    v_lead3_id uuid;
BEGIN
    -- Check if leads already exist
    IF NOT EXISTS (SELECT 1 FROM "sales-pipe".leads LIMIT 1) THEN
        -- Lead 1: WhatsApp
        INSERT INTO "sales-pipe".leads (
            business_name, email, phone, instagram_handle, company_type, channel, stage, follow_up_count, next_follow_up
        ) VALUES (
            'The Green Bakery', 'hello@thegreenbakery.co.uk', '+447123456789', 'greenbakeryuk', 'sole_trader', 'WhatsApp', 'Contacted', 1, CURRENT_DATE
        ) RETURNING id INTO v_lead1_id;

        INSERT INTO "sales-pipe".tasks (title, description, due_date, status, task_type, lead_id)
        VALUES ('The Green Bakery: Follow-up 1 (WhatsApp)', 'Following up on WhatsApp message. Check menu inquiry.', CURRENT_DATE, 'open', 'sales_followup', v_lead1_id);

        -- Lead 2: Email (Limited Company, PECR compliant)
        INSERT INTO "sales-pipe".leads (
            business_name, email, phone, instagram_handle, company_type, channel, stage, follow_up_count, next_follow_up
        ) VALUES (
            'Apex Logistics Ltd', 'director@apexlogistics.co.uk', '+447987654321', 'apexlogistics', 'limited', 'Email', 'Contacted', 2, CURRENT_DATE
        ) RETURNING id INTO v_lead2_id;

        INSERT INTO "sales-pipe".tasks (title, description, due_date, status, task_type, lead_id)
        VALUES ('Apex Logistics Ltd: Follow-up 2 (Email)', 'Follow-up regarding commercial fleet booking software.', CURRENT_DATE, 'open', 'sales_followup', v_lead2_id);

        -- Lead 3: Instagram
        INSERT INTO "sales-pipe".leads (
            business_name, email, phone, instagram_handle, company_type, channel, stage, follow_up_count, next_follow_up
        ) VALUES (
            'Studio Bloom Floral', 'info@bloomstudio.co.uk', '+447555123456', 'bloomstudio.ldn', 'sole_trader', 'Instagram', 'New', 0, CURRENT_DATE
        ) RETURNING id INTO v_lead3_id;

        INSERT INTO "sales-pipe".tasks (title, description, due_date, status, task_type, lead_id)
        VALUES ('Studio Bloom Floral: Send First Outreach (Instagram)', 'Send initial greeting DM on Instagram.', CURRENT_DATE, 'open', 'sales_followup', v_lead3_id);

        -- Log initial seeding
        INSERT INTO "sales-pipe".app_logs (event, category, details)
        VALUES ('database_seeded', 'setup', jsonb_build_object('leads_count', 3));
    END IF;
END $$;
