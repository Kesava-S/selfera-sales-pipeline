-- ==============================================================================
-- seed_sample_cafes.sql
-- SAMPLE DATA for testing the v2 dashboard: 14 real cafés from our lead list.
-- Run AFTER migrations 13, 15, 16, 17, 18 (skip 14).
-- All rows use business_code 'SAMPLE-xx' so they are easy to remove.
-- To remove everything:  delete from "sales-pipe".businesses where business_code like 'SAMPLE-%';
-- Safe to re-run: it removes old sample rows first.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

DELETE FROM "sales-pipe".businesses WHERE business_code LIKE 'SAMPLE-%';

DO $$
DECLARE
  b uuid; o uuid; t uuid;
BEGIN
  -- 1. Café NOVA Bistro: Website, first contact sent 3 days ago, Follow-up 1 due today
  INSERT INTO businesses (business_code, business_name, business_type, category, area, address, postcode, google_rating, google_reviews_count, phone, whatsapp_number, instagram, company_type, notes)
  VALUES ('SAMPLE-01','Café NOVA Bistro','Cafe','Food & Drink','East Twickenham','424 Richmond Rd, East Twickenham','TW1 2EB',4.9,653,'07453 302323','07453 302323','cafenovabistro','Unknown','Open Mon to Fri 7am to 5pm, Sat and Sun 8am to 5pm. Website demo built.')
  RETURNING id INTO b;
  INSERT INTO opportunities (business_id, services_pitched, stage, created_at) VALUES (b, ARRAY['Website'], 'Active', now() - interval '3 days') RETURNING id INTO o;
  INSERT INTO threads (opportunity_id, platform, status, step, next_due_on, last_outbound_at) VALUES (o,'WhatsApp','Awaiting reply',1,current_date, now() - interval '3 days') RETURNING id INTO t;
  INSERT INTO messages (thread_id, direction, body, step_label, send_method, delivery_status, created_at) VALUES
    (t,'outbound','Hi, I''m Kesav from Selfera. Love what you''ve built at Café NOVA Bistro, 4.9 stars from 653 reviews is brilliant. I noticed you don''t have a website yet, so I made a free demo for you. Happy to send the link?','First contact','manual','sent', now() - interval '3 days');
  INSERT INTO drafts (thread_id, step_label, body, status, due_on) VALUES
    (t,'Follow-up 1','Hi again, just checking you saw my message about the free website demo for Café NOVA Bistro. Happy to send the link whenever suits you.','ready',current_date);
  INSERT INTO threads (opportunity_id, platform, status, step, next_due_on, last_outbound_at) VALUES (o,'Instagram','Awaiting reply',1,current_date, now() - interval '3 days') RETURNING id INTO t;
  INSERT INTO messages (thread_id, direction, body, step_label, send_method, delivery_status, created_at) VALUES
    (t,'outbound','Hi Café NOVA Bistro team, I''m Kesav from Selfera. I made a free website demo for you. Would you like to see it?','First contact','manual','sent', now() - interval '3 days');

  -- 2. Wild Thing Colombian Coffee: replied on WhatsApp, consultation booked
  INSERT INTO businesses (business_code, business_name, business_type, category, area, address, postcode, google_rating, google_reviews_count, phone, whatsapp_number, instagram, contact_name, company_type)
  VALUES ('SAMPLE-02','Wild Thing Colombian Coffee','Cafe','Food & Drink','West Ealing','148 Broadway, West Ealing','W13 0TL',4.9,174,'07710 580743','07710 580743','wildthing.coffee','Mauricio','Unknown')
  RETURNING id INTO b;
  INSERT INTO opportunities (business_id, services_pitched, stage, consultation_at, created_at) VALUES (b, ARRAY['Website','Micro Automation'], 'Consultation', now() + interval '2 days', now() - interval '8 days') RETURNING id INTO o;
  INSERT INTO threads (opportunity_id, platform, status, step, last_outbound_at, last_inbound_at) VALUES (o,'WhatsApp','Replied',1, now() - interval '8 days', now() - interval '5 days') RETURNING id INTO t;
  INSERT INTO messages (thread_id, direction, body, step_label, send_method, delivery_status, created_at) VALUES
    (t,'outbound','Hi Mauricio, I''m Kesav from Selfera. I made a free website demo for Wild Thing, with your menu and the tea of the day. Would you like to see it?','First contact','manual','sent', now() - interval '8 days'),
    (t,'inbound','Hi Kesav, yes please send it over. Looks interesting.',NULL,'webhook',NULL, now() - interval '6 days'),
    (t,'outbound','Great, here it is. We can also automate your online orders. Would a 20 minute call work this week?','Reply','api','sent', now() - interval '6 days' + interval '1 hour'),
    (t,'inbound','Sure, I booked a slot on your website.',NULL,'webhook',NULL, now() - interval '5 days'),
    (t,'system','Consultation booked from the website.',NULL,NULL,NULL, now() - interval '5 days' + interval '5 minutes');
  INSERT INTO threads (opportunity_id, platform, status, step, paused_reason, last_outbound_at) VALUES (o,'Instagram','Paused',1,'Replied on WhatsApp', now() - interval '8 days') RETURNING id INTO t;
  INSERT INTO messages (thread_id, direction, body, step_label, send_method, delivery_status, created_at) VALUES
    (t,'outbound','Hi Wild Thing team, I''m Kesav from Selfera. I made a free website demo for you. Can I send the link?','First contact','manual','sent', now() - interval '8 days');
  INSERT INTO stage_changes (opportunity_id, from_stage, to_stage, reason, created_at) VALUES
    (o,'Active','Interested','Replied on WhatsApp', now() - interval '6 days'),
    (o,'Interested','Consultation','Booked on website', now() - interval '5 days');

  -- 3. Mooca Café: replied on Instagram asking about price
  INSERT INTO businesses (business_code, business_name, business_type, category, area, address, postcode, google_rating, google_reviews_count, phone, instagram, company_type)
  VALUES ('SAMPLE-03','Mooca Café','Cafe','Food & Drink','Richmond','7 Golden Ct, Richmond','TW9 1EU',4.7,438,'020 3345 1530','mooca_cafe_richmond','Unknown')
  RETURNING id INTO b;
  INSERT INTO opportunities (business_id, services_pitched, stage, created_at) VALUES (b, ARRAY['Website'], 'Interested', now() - interval '6 days') RETURNING id INTO o;
  INSERT INTO threads (opportunity_id, platform, status, step, last_outbound_at, last_inbound_at) VALUES (o,'Instagram','Replied',1, now() - interval '6 days', now() - interval '1 day') RETURNING id INTO t;
  INSERT INTO messages (thread_id, direction, body, step_label, send_method, delivery_status, created_at) VALUES
    (t,'outbound','Hi Mooca team, I''m Kesav from Selfera. I made a free website demo for Mooca Café. Would you like to see it?','First contact','manual','sent', now() - interval '6 days'),
    (t,'inbound','Hi, how much would it cost?',NULL,'webhook',NULL, now() - interval '1 day');
  INSERT INTO threads (opportunity_id, platform, status, step, paused_reason) VALUES (o,'Phone','Paused',0,'Replied on Instagram');

  -- 4. Rich Café: imported, waiting for review (no socials yet)
  INSERT INTO businesses (business_code, business_name, business_type, category, area, address, postcode, google_rating, google_reviews_count, phone, company_type)
  VALUES ('SAMPLE-04','Rich Café','Cafe','Food & Drink','East Twickenham','435 Richmond Rd, East Twickenham','TW1 2EF',4.7,304,'020 4568 5234','Unknown')
  RETURNING id INTO b;
  INSERT INTO opportunities (business_id, services_pitched, stage) VALUES (b, ARRAY['Website'], 'Needs review');

  -- 5. QBrü Coffee: Follow-up 1 sent, Follow-up 2 due in 2 days
  INSERT INTO businesses (business_code, business_name, business_type, category, area, address, postcode, google_rating, google_reviews_count, phone, instagram, company_type)
  VALUES ('SAMPLE-05','QBrü Coffee','Cafe','Food & Drink','Richmond','96 Kew Rd, Richmond','TW9 2PQ',4.5,140,'020 8940 0733','qbrucoffee','Unknown')
  RETURNING id INTO b;
  INSERT INTO opportunities (business_id, services_pitched, stage, created_at) VALUES (b, ARRAY['Website'], 'Active', now() - interval '6 days') RETURNING id INTO o;
  INSERT INTO threads (opportunity_id, platform, status, step, next_due_on, last_outbound_at) VALUES (o,'Instagram','Awaiting reply',2,current_date + 2, now() - interval '2 days') RETURNING id INTO t;
  INSERT INTO messages (thread_id, direction, body, step_label, send_method, delivery_status, created_at) VALUES
    (t,'outbound','Hi QBrü team, I''m Kesav from Selfera. I made a free website demo for QBrü Coffee. Would you like to see it?','First contact','manual','sent', now() - interval '6 days'),
    (t,'outbound','Hi again, just checking you saw my message about the free demo. No pressure at all.','Follow-up 1','manual','sent', now() - interval '2 days');

  -- 6. Cafe Milano: Follow-up 2 sent on Facebook, final check in 10 days
  INSERT INTO businesses (business_code, business_name, business_type, category, area, address, postcode, google_rating, google_reviews_count, phone, facebook, company_type)
  VALUES ('SAMPLE-06','Cafe Milano','Cafe','Food & Drink','Richmond','8 Lichfield Ct, Sheen Rd, Richmond','TW9 1AS',4.8,117,'020 3659 4410','Cafe-Milano-Richmond','Unknown')
  RETURNING id INTO b;
  INSERT INTO opportunities (business_id, services_pitched, stage, created_at) VALUES (b, ARRAY['Website'], 'Active', now() - interval '12 days') RETURNING id INTO o;
  INSERT INTO threads (opportunity_id, platform, status, step, next_due_on, last_outbound_at) VALUES (o,'Facebook','Awaiting reply',3,current_date + 10, now() - interval '4 days') RETURNING id INTO t;
  INSERT INTO messages (thread_id, direction, body, step_label, send_method, delivery_status, created_at) VALUES
    (t,'outbound','Hi Cafe Milano, I''m Kesav from Selfera. I made a free website demo for you. Would you like to see it?','First contact','manual','sent', now() - interval '12 days'),
    (t,'outbound','Hi again, just checking you saw my message about the free demo.','Follow-up 1','manual','sent', now() - interval '9 days'),
    (t,'outbound','Last nudge from me. The demo is ready whenever you want a look.','Follow-up 2','manual','sent', now() - interval '4 days');

  -- 7. Cafe Nano: new outreach on all 4 platforms, drafts ready today
  INSERT INTO businesses (business_code, business_name, business_type, category, area, address, postcode, google_rating, google_reviews_count, phone, whatsapp_number, email, instagram, facebook, existing_website, company_type, notes)
  VALUES ('SAMPLE-07','Cafe Nano','Cafe','Food & Drink','Richmond','76 Sheen Rd, Richmond','TW9 1UF',4.8,92,'07514 953005','07514 953005','orders@partyplatter.co.uk','cafenano','Cafenanorichmond','Wix site','Unknown','Has a basic Wix site. Also runs party platters.')
  RETURNING id INTO b;
  INSERT INTO opportunities (business_id, services_pitched, stage) VALUES (b, ARRAY['Website','Micro Automation'], 'Active') RETURNING id INTO o;
  INSERT INTO threads (opportunity_id, platform, status, step, next_due_on) VALUES (o,'WhatsApp','Not contacted',0,current_date) RETURNING id INTO t;
  INSERT INTO drafts (thread_id, step_label, body, status, due_on) VALUES (t,'First contact','Hi, I''m Kesav from Selfera. I love Cafe Nano and your party platters. I made a free demo of a new website with online platter orders. Can I send you the link?','ready',current_date);
  INSERT INTO threads (opportunity_id, platform, status, step, next_due_on) VALUES (o,'Email','Not contacted',0,current_date) RETURNING id INTO t;
  INSERT INTO drafts (thread_id, step_label, subject, body, status, due_on, missing_fields) VALUES (t,'First contact','A free website demo for Cafe Nano','Hi there,

I''m Kesav from Selfera. I made a free demo of a new website for Cafe Nano, with online orders for your party platters. Would you like to see it?

Kesav
Selfera
Reply STOP and I won''t contact you again.','needs_data',current_date, ARRAY['company_type']);
  INSERT INTO threads (opportunity_id, platform, status, step, next_due_on) VALUES (o,'Instagram','Not contacted',0,current_date) RETURNING id INTO t;
  INSERT INTO drafts (thread_id, step_label, body, status, due_on) VALUES (t,'First contact','Hi Cafe Nano team, I''m Kesav from Selfera. I made a free website demo for you with platter orders built in. Would you like to see it?','ready',current_date);
  INSERT INTO threads (opportunity_id, platform, status, step, next_due_on) VALUES (o,'Facebook','Not contacted',0,current_date) RETURNING id INTO t;
  INSERT INTO drafts (thread_id, step_label, body, status, due_on) VALUES (t,'First contact','Hi Cafe Nano, I''m Kesav from Selfera. I made a free website demo for you. Would you like to see it?','ready',current_date);

  -- 8. Café Torelli: no reply after all 4 steps
  INSERT INTO businesses (business_code, business_name, business_type, category, area, address, postcode, google_rating, google_reviews_count, instagram, company_type)
  VALUES ('SAMPLE-08','Café Torelli','Cafe','Food & Drink','Kew','131 Kew Rd, Richmond','TW9 2PN',4.4,63,'cafetorellikew','Unknown')
  RETURNING id INTO b;
  INSERT INTO opportunities (business_id, services_pitched, stage, closed_at, created_at) VALUES (b, ARRAY['Website'], 'No response', now() - interval '1 day', now() - interval '30 days') RETURNING id INTO o;
  INSERT INTO threads (opportunity_id, platform, status, step, last_outbound_at) VALUES (o,'Instagram','No reply',4, now() - interval '1 day') RETURNING id INTO t;
  INSERT INTO messages (thread_id, direction, body, step_label, send_method, delivery_status, created_at) VALUES
    (t,'outbound','Hi Café Torelli, I''m Kesav from Selfera. I made a free website demo for you. Would you like to see it?','First contact','manual','sent', now() - interval '30 days'),
    (t,'outbound','Hi again, just checking you saw my message.','Follow-up 1','manual','sent', now() - interval '26 days'),
    (t,'outbound','Last nudge from me. The demo is ready whenever you want a look.','Follow-up 2','manual','sent', now() - interval '19 days'),
    (t,'outbound','I''ll leave it here. If you ever want the demo, just message me.','Final check','manual','sent', now() - interval '1 day'),
    (t,'system','No reply after the final check. Moved to No response.',NULL,NULL,NULL, now() - interval '1 day');

  -- 9. Magnolia Cafe: WON (pitched Website, won Website + Micro Automation after consultation)
  INSERT INTO businesses (business_code, business_name, business_type, category, area, address, postcode, google_rating, google_reviews_count, phone, whatsapp_number, instagram, company_type)
  VALUES ('SAMPLE-09','Magnolia Cafe','Cafe','Food & Drink','Twickenham','Cambridge Gardens Park, Twickenham','TW1 2TY',4.8,67,'07435 263633','07435 263633','magnoliatreecafe','Unknown')
  RETURNING id INTO b;
  INSERT INTO opportunities (business_id, services_pitched, services_won, conversion_type, converted_through, stage, won_at, upsell_reminder_on, created_at)
  VALUES (b, ARRAY['Website'], ARRAY['Website','Micro Automation'], 'Expanded', 'Consultation', 'Won', now() - interval '2 days', current_date + 28, now() - interval '15 days') RETURNING id INTO o;
  INSERT INTO threads (opportunity_id, platform, status, step, last_outbound_at, last_inbound_at) VALUES (o,'WhatsApp','Replied',1, now() - interval '15 days', now() - interval '13 days') RETURNING id INTO t;
  INSERT INTO messages (thread_id, direction, body, step_label, send_method, delivery_status, created_at) VALUES
    (t,'outbound','Hi, I''m Kesav from Selfera. I made a free website demo for Magnolia Cafe. Would you like to see it?','First contact','manual','sent', now() - interval '15 days'),
    (t,'inbound','Yes! We''ve wanted a website for ages.',NULL,'webhook',NULL, now() - interval '13 days'),
    (t,'system','Won: Website + Micro Automation (converted through Consultation).',NULL,NULL,NULL, now() - interval '2 days');
  INSERT INTO threads (opportunity_id, platform, status, step, paused_reason) VALUES (o,'Instagram','Paused',0,'Replied on WhatsApp');
  INSERT INTO stage_changes (opportunity_id, from_stage, to_stage, from_services, to_services, reason, created_at) VALUES
    (o,'Active','Interested',NULL,NULL,'Replied on WhatsApp', now() - interval '13 days'),
    (o,'Interested','Consultation',NULL,NULL,'Handed over', now() - interval '10 days'),
    (o,'Consultation','Won',ARRAY['Website'],ARRAY['Website','Micro Automation'],'Added booking automation after the call', now() - interval '2 days');

  -- 10. Eileen's at Buccleuch Gardens: imported, missing contact details
  INSERT INTO businesses (business_code, business_name, business_type, category, area, address, postcode, google_rating, google_reviews_count, company_type, notes)
  VALUES ('SAMPLE-10','Eileen''s at Buccleuch Gardens','Cafe','Food & Drink','Richmond','Petersham Rd, Richmond','TW10 6UX',4.7,207,'Unknown','No phone or socials found yet. Walk-in only.')
  RETURNING id INTO b;
  INSERT INTO opportunities (business_id, services_pitched, stage) VALUES (b, ARRAY['Website'], 'Needs review');

  -- 11. Mike's Cafe: replied once, then went silent
  INSERT INTO businesses (business_code, business_name, business_type, category, area, address, postcode, google_rating, google_reviews_count, phone, instagram, company_type)
  VALUES ('SAMPLE-11','Mike''s Cafe','Cafe','Food & Drink','Notting Hill','12 Blenheim Cres','W11 1NN',4.6,1065,'020 7229 3757','mikescafeportobello','Unknown')
  RETURNING id INTO b;
  INSERT INTO opportunities (business_id, services_pitched, stage, created_at) VALUES (b, ARRAY['Website'], 'Went cold', now() - interval '25 days') RETURNING id INTO o;
  INSERT INTO threads (opportunity_id, platform, status, step, last_outbound_at, last_inbound_at) VALUES (o,'Instagram','Replied',1, now() - interval '18 days', now() - interval '22 days') RETURNING id INTO t;
  INSERT INTO messages (thread_id, direction, body, step_label, send_method, delivery_status, created_at) VALUES
    (t,'outbound','Hi Mike''s Cafe, I''m Kesav from Selfera. I made a free website demo for you. Would you like to see it?','First contact','manual','sent', now() - interval '25 days'),
    (t,'inbound','Maybe, send it over.',NULL,'webhook',NULL, now() - interval '22 days'),
    (t,'outbound','Here you go. Happy to walk you through it on a quick call.','Reply','api','sent', now() - interval '22 days' + interval '2 hours'),
    (t,'outbound','Hi, just checking if you had a chance to look at the demo?','Follow-up 1','api','sent', now() - interval '18 days');

  -- 12. BNB Cafe and Bar: End-to-End Automation pitch by phone
  INSERT INTO businesses (business_code, business_name, business_type, category, area, address, postcode, google_rating, google_reviews_count, phone, company_type)
  VALUES ('SAMPLE-12','BNB Cafe and Bar','Cafe','Food & Drink','Notting Hill','219 Westbourne Park Rd','W11 1EA',4.6,835,'020 7243 9223','Unknown')
  RETURNING id INTO b;
  INSERT INTO opportunities (business_id, services_pitched, stage, created_at) VALUES (b, ARRAY['End-to-End Automation'], 'Active', now() - interval '2 days') RETURNING id INTO o;
  INSERT INTO threads (opportunity_id, platform, status, step, next_due_on, last_outbound_at) VALUES (o,'Phone','Awaiting reply',1,current_date + 1, now() - interval '2 days') RETURNING id INTO t;
  INSERT INTO messages (thread_id, direction, body, step_label, send_method, delivery_status, created_at) VALUES
    (t,'outbound','Called. Spoke to staff, the manager is in on Thursday. Call back then.','First contact','manual','sent', now() - interval '2 days');

  -- 13. Cafe de Fred: declined politely
  INSERT INTO businesses (business_code, business_name, business_type, category, area, address, postcode, google_rating, google_reviews_count, phone, whatsapp_number, instagram, company_type, notes)
  VALUES ('SAMPLE-13','Cafe de Fred','Cafe','Food & Drink','Earls Court','10A Earls Ct Rd','W8 6EA',4.8,728,'07960 722425','07960 722425','cafe_defred','Unknown','Email orders@cafedefred.co.uk not verified.')
  RETURNING id INTO b;
  INSERT INTO opportunities (business_id, services_pitched, stage, closed_at, created_at) VALUES (b, ARRAY['Website'], 'Declined', now() - interval '3 days', now() - interval '9 days') RETURNING id INTO o;
  INSERT INTO threads (opportunity_id, platform, status, step, last_outbound_at, last_inbound_at) VALUES (o,'WhatsApp','Replied',1, now() - interval '9 days', now() - interval '3 days') RETURNING id INTO t;
  INSERT INTO messages (thread_id, direction, body, step_label, send_method, delivery_status, created_at) VALUES
    (t,'outbound','Hi, I''m Kesav from Selfera. I made a free website demo for Cafe de Fred. Would you like to see it?','First contact','manual','sent', now() - interval '9 days'),
    (t,'inbound','Thanks but we''re happy with Instagram for now.',NULL,'webhook',NULL, now() - interval '3 days');
  INSERT INTO threads (opportunity_id, platform, status, step, paused_reason) VALUES (o,'Instagram','Paused',0,'Replied on WhatsApp');

  -- 14. St Clair Cafe: Custom Dashboard pitch, Follow-up 1 due today
  INSERT INTO businesses (business_code, business_name, business_type, category, area, address, postcode, google_rating, google_reviews_count, instagram, company_type)
  VALUES ('SAMPLE-14','St Clair Cafe','Cafe','Food & Drink','Notting Hill','98 Portland Rd','W11 4QL',4.8,121,'st.clair.cafe','Unknown')
  RETURNING id INTO b;
  INSERT INTO opportunities (business_id, services_pitched, stage, created_at) VALUES (b, ARRAY['Custom Dashboard'], 'Active', now() - interval '3 days') RETURNING id INTO o;
  INSERT INTO threads (opportunity_id, platform, status, step, next_due_on, last_outbound_at) VALUES (o,'Instagram','Awaiting reply',1,current_date, now() - interval '3 days') RETURNING id INTO t;
  INSERT INTO messages (thread_id, direction, body, step_label, send_method, delivery_status, created_at) VALUES
    (t,'outbound','Hi St Clair team, I''m Kesav from Selfera. We build simple dashboards that show your daily sales and stock in one place. Would a quick demo be useful?','First contact','manual','sent', now() - interval '3 days');
  INSERT INTO drafts (thread_id, step_label, body, status, due_on) VALUES
    (t,'Follow-up 1','Hi again, just checking you saw my message about the dashboard demo. Happy to show you in 10 minutes.','ready',current_date);
END $$;

-- Quick check: should show 14 sample pitches across the stages
SELECT o.stage, count(*) AS pitches FROM "sales-pipe".opportunities o
JOIN "sales-pipe".businesses b ON b.id = o.business_id
WHERE b.business_code LIKE 'SAMPLE-%' GROUP BY o.stage ORDER BY 1;
