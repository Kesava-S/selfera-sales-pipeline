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
