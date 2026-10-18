-- =====================================================================
-- Reset to 3 demo businesses (Development clean-up, October 2026)
-- Run once in the Supabase SQL Editor of EACH database: Dev, Staging, Prod.
-- Run migrations/30_v2_scraping_and_proposals.sql first.
-- Keeps: profiles (team logins), templates, cadence_rules, settings.
-- Deletes: every lead, pitch, thread, message, draft, note and log.
-- WARNING: cannot be undone.
-- =====================================================================

BEGIN;

-- 1. Wipe pipeline data (only tables that exist in this database)
DO $$
DECLARE
  t text;
  wipe text[] := ARRAY[
    'proposal_page_views','proposal_pages','scrape_results','scrape_runs',
    'messages','drafts','threads','notes','stage_changes','notifications',
    'consultation_bookings','opportunities','businesses',
    'email_campaigns','email_databases',
    'app_logs','user_logs','error_logs',
    -- legacy v1 tables (skipped if not present)
    'activity_log','tasks','lead_service_history','leads'
  ];
BEGIN
  FOREACH t IN ARRAY wipe LOOP
    IF to_regclass(format('"sales-pipe".%I', t)) IS NOT NULL THEN
      EXECUTE format('TRUNCATE TABLE "sales-pipe".%I RESTART IDENTITY CASCADE', t);
      RAISE NOTICE 'Wiped %', t;
    END IF;
  END LOOP;
END $$;

-- 2. Demo businesses
-- Contact details route to Kesav's own inbox/phone so test sends never reach a real business.
INSERT INTO "sales-pipe".businesses
  (business_name, category, business_type, tier, room_count, area, address, postcode,
   phone, whatsapp_number, email, instagram, existing_website, company_type, contact_name, notes,
   companies_house_number, linkedin, lead_source)
VALUES
  ('Krish Homestay', 'Accommodation', 'B&B / Guesthouse', '1-2 star', NULL,
   'Munnar, Kerala, India', NULL, NULL,
   '+447818657095', '+447818657095', 'kesavperso+krish@gmail.com', NULL, NULL,
   'Unknown', 'Owner',
   'DEMO DATA. Family-run homestay. TEST CONTACT: phone and email route to Kesav.',
   NULL, NULL, 'manual'),

  ('Hamlet Hotels', 'Accommodation', 'Hotel', '3 star', NULL,
   'Maidstone, Kent (group head office London)', '71-75 Shelton Street, London', 'WC2H 9JQ',
   NULL, NULL, 'kesavperso+hamlet@gmail.com', 'hamlet_hotels', 'https://hamlethotels.com',
   'Limited company', 'Prasanna Kirubakaran (CEO)',
   'DEMO DATA based on public research (Oct 2026). Group of 6 hotels on SynXis + GDS (Maidstone, Reading, Kidderminster, Hull, Thurrock, plus others on GDS list). Mixed booking engines, only Thurrock collects emails, ~200 Instagram followers per account. TEST CONTACT: email routes to Kesav. Real contact: LinkedIn linkedin.com/in/prasannakirubakaran',
   '12978226', 'https://www.linkedin.com/in/prasannakirubakaran/', 'manual'),

  ('Riverside Boutique Hotel', 'Accommodation', 'Boutique hotel', '3 star', 24,
   'Reading', '12 Kennet Walk, Reading', 'RG1 3GD',
   NULL, NULL, 'kesavperso+riverside@gmail.com', 'riverside_boutique_demo', NULL,
   'Limited company', 'General Manager',
   'DEMO DATA. Fictional hotel for testing. TEST CONTACT: email routes to Kesav.',
   NULL, NULL, 'manual');

-- 3. One pitch per business, waiting in the Approval Queue
INSERT INTO "sales-pipe".opportunities (business_id, services_pitched, stage)
SELECT id,
  CASE business_name
    WHEN 'Krish Homestay'           THEN ARRAY['Micro Automation']
    WHEN 'Hamlet Hotels'            THEN ARRAY['End-to-End Automation','Custom Dashboard']
    WHEN 'Riverside Boutique Hotel' THEN ARRAY['Website','Micro Automation']
  END,
  'Needs review'
FROM "sales-pipe".businesses;

COMMIT;

-- Check: should show 3 businesses and 3 opportunities
SELECT b.business_code, b.business_name, o.opportunity_code, o.stage, o.services_pitched
FROM "sales-pipe".businesses b JOIN "sales-pipe".opportunities o ON o.business_id = b.id
ORDER BY b.business_name;

NOTIFY pgrst, 'reload schema';
