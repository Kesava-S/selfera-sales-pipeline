-- ==============================================================================
-- 14_v2_data_migration.sql
-- Selfera Sales Dashboard v2 Data Migration
-- ==============================================================================

SET search_path TO "sales-pipe", public;

-- ==============================================================================
-- MIGRATION: leads_legacy -> businesses, opportunities, threads
-- ==============================================================================

DO $$
DECLARE
    legacy_record record;
    new_business_id uuid;
    new_opp_id uuid;
    new_thread_id uuid;
    mapped_service text;
    mapped_services_won text[];
    mapped_stage text;
    mapped_thread_status text;
BEGIN
    FOR legacy_record IN 
        SELECT * FROM "sales-pipe".leads_legacy
    LOOP
        -- 1. Create Business
        INSERT INTO "sales-pipe".businesses (
            business_name,
            business_type, -- fallback since legacy didn't have this
            company_type,
            phone,
            phone_normalised,
            email,
            email_normalised,
            instagram,
            created_at
        ) VALUES (
            legacy_record.business_name,
            'Other', -- generic default
            CASE 
                WHEN legacy_record.company_type = 'limited' THEN 'Limited company'
                WHEN legacy_record.company_type = 'sole_trader' THEN 'Sole trader'
                ELSE 'Unknown'
            END,
            legacy_record.phone,
            -- Rough normalisation for existing data: just remove spaces
            REPLACE(legacy_record.phone, ' ', ''),
            legacy_record.email,
            LOWER(TRIM(legacy_record.email)),
            legacy_record.instagram_handle,
            legacy_record.created_at
        )
        RETURNING id INTO new_business_id;

        -- Map Services
        -- legacy current_service was text: Website Services, Dashboard Services, Micro Services, End to End Automation, Cold Outreach
        mapped_service := CASE 
            WHEN legacy_record.current_service = 'Website Services' THEN 'Website'
            WHEN legacy_record.current_service = 'Dashboard Services' THEN 'Custom Dashboard'
            WHEN legacy_record.current_service = 'Micro Services' THEN 'Micro Automation'
            WHEN legacy_record.current_service = 'End to End Automation' THEN 'End-to-End Automation'
            WHEN legacy_record.current_service = 'Cold Outreach' THEN 'Cold Outreach'
            ELSE 'Website' -- fallback
        END;

        mapped_services_won := CASE 
            WHEN legacy_record.agreed_service = 'Website Services' THEN ARRAY['Website']
            WHEN legacy_record.agreed_service = 'Dashboard Services' THEN ARRAY['Custom Dashboard']
            WHEN legacy_record.agreed_service = 'Micro Services' THEN ARRAY['Micro Automation']
            WHEN legacy_record.agreed_service = 'End to End Automation' THEN ARRAY['End-to-End Automation']
            WHEN legacy_record.agreed_service = 'Cold Outreach' THEN ARRAY['Cold Outreach']
            ELSE NULL
        END;

        -- Map Stages
        mapped_stage := CASE 
            WHEN legacy_record.stage IN ('New', 'Contacted', 'Replied') THEN 'Active'
            WHEN legacy_record.stage = 'Lost' THEN 'No response'
            ELSE legacy_record.stage
        END;

        mapped_thread_status := CASE
            WHEN legacy_record.stage = 'Replied' THEN 'Replied'
            WHEN legacy_record.stage = 'Contacted' THEN 'Awaiting reply'
            WHEN legacy_record.stage = 'Lost' THEN 'No reply'
            WHEN legacy_record.stage = 'Do not contact' THEN 'Opted out'
            ELSE 'Not contacted'
        END;

        -- 2. Create Opportunity
        INSERT INTO "sales-pipe".opportunities (
            business_id,
            services_pitched,
            services_won,
            stage,
            created_at
        ) VALUES (
            new_business_id,
            ARRAY[mapped_service],
            mapped_services_won,
            mapped_stage,
            legacy_record.created_at
        )
        RETURNING id INTO new_opp_id;

        -- 3. Create Thread
        INSERT INTO "sales-pipe".threads (
            opportunity_id,
            platform,
            status,
            step,
            next_due_on,
            created_at
        ) VALUES (
            new_opp_id,
            legacy_record.channel,
            mapped_thread_status,
            CASE 
                WHEN legacy_record.follow_up_count > 3 THEN 4
                ELSE legacy_record.follow_up_count
            END,
            legacy_record.next_follow_up,
            legacy_record.created_at
        )
        RETURNING id INTO new_thread_id;

        -- 4. Migrate Activity Logs to Messages (System direction)
        INSERT INTO "sales-pipe".messages (
            thread_id,
            direction,
            body,
            created_at
        )
        SELECT 
            new_thread_id,
            'system',
            COALESCE(al.details, 'Action: ' || al.action_type),
            al.created_at
        FROM "sales-pipe".activity_log_legacy al
        WHERE al.lead_id = legacy_record.id;

    END LOOP;
END $$;
