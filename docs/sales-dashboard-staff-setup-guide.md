# Sales Pipeline Dashboard: Staff Setup Guide

**Purpose:** connect the new sales dashboard to our existing Supabase project and n8n.
**Time needed:** about 1 to 2 hours.

---

## 1. What we're setting up

| Part | Role |
|---|---|
| **Sales dashboard** (Next.js on Vercel) | Daily screen for the salesperson: Today tasks, Leads, Templates |
| **Supabase** (existing project) | Database + login. New tables: `leads`, `activity_log`, `templates`. Existing `tasks` table gets 2 new columns |
| **n8n** | Runs once a day. Sends follow-up emails automatically, creates tasks for everything else |

**Golden rule:** all follow-up logic lives in the database function `record_outreach`. Neither n8n nor the dashboard should calculate stages or dates themselves.

---

## 2. Supabase (do first)

1. **Back up** the existing `tasks` table (export CSV) before running anything.
2. Open the repo folder `/supabase/migrations/` and run each file **in order** in the Supabase SQL editor.
3. Check the `tasks` changes: two new columns, `task_type` (default `general`) and `lead_id` (nullable). Existing staff tasks are not affected.
4. If our `tasks` table uses different column names from `title, description, assigned_to, due_date, status`, update **`lib/config.ts`** and the migration before running.
5. Optional: run `supabase/seed.sql` to add 3 test leads.
6. Confirm **RLS is enabled** on `leads`, `activity_log` and `templates`.

---

## 3. Dashboard (Vercel)

1. Deploy the repo to Vercel.
2. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **Never** put the service role key in Vercel or the app.
4. Create users: Supabase → Authentication → **Invite user** (there is no sign-up page).
5. Log in and check the Today, Leads, Add lead and Templates pages load.

---

## 4. n8n workflow: "Sales follow-ups (daily)"

**Credentials:** Supabase node using the **service role key** (n8n only). Email via our outreach mailbox (SMTP or Gmail).

**Flow:**

1. **Schedule trigger:** 9:00, Monday to Friday, timezone Europe/London.
2. **Supabase: get rows** from view `leads_due_today`.
3. **Switch** on each row:

| Condition | Action |
|---|---|
| `follow_up_count` = 3 (final check) | Call `record_outreach(lead_id, 'no_reply_final')`. No message sent |
| `stage` = Won (upsell reminder) | Insert task (see below) using the upsell note |
| `channel` = Email **and** email is not empty | Send email (`message_subject`, `message_body`), then call `record_outreach(lead_id, 'sent', null, 'Email sent (auto)')` |
| Anything else (WhatsApp, Instagram, Phone, Walk-in, or Email with no address) | Insert task (see below) |

4. **Insert task** into `tasks`:
   - `task_type` = `sales_followup`
   - `lead_id` = lead id
   - `title` = `{business_name}: {step}`
   - `description` = `message_body`
   - `assigned_to` = lead's `assigned_to` (fallback: the salesperson's user id)
   - `due_date` = today
   - `status` = open value
5. **Error handling:** on any failure, send one alert to the admin (email) with the lead code and error. Don't retry sending emails automatically.

**How to call the function in n8n:** HTTP Request node, `POST {SUPABASE_URL}/rest/v1/rpc/record_outreach`, headers `apikey` and `Authorization: Bearer {service_role_key}`, JSON body:

```json
{ "p_lead_id": "<uuid>", "p_action": "sent", "p_task_id": null, "p_details": "Email sent (auto)" }
```

---

## 5. Pipeline rules (for reference, already in the database)

| Event | Result |
|---|---|
| First message sent | Stage Contacted, next follow-up +3 days |
| Follow-up 1 sent | Next follow-up +5 days |
| Follow-up 2 sent | Next follow-up +14 days (final check) |
| Final check, no reply | Stage Lost |
| Replied | Stage Replied, follow-ups stop |
| Interested | Reminder in 2 days |
| Won | Offer added to products won, upsell reminder in 30 days |
| Do not contact / Lost | Follow-ups stop |

Weekends are skipped automatically. The salesperson marks manual messages via **Mark as sent** on the Today screen.

---

## 6. Test before going live

1. Add a test lead with **your own** email, channel = Email, and a test lead with channel = WhatsApp.
2. On each, click **Mark as sent** in Lead detail.
3. In Supabase, set their `next_follow_up` to today.
4. Run the n8n workflow manually and check:
   - The Email lead received the email, and `activity_log` shows it
   - The WhatsApp lead has a new task on the Today screen with a working WhatsApp link
   - `follow_up_count` and `next_follow_up` updated correctly
5. Click **Replied** on the task: the task closes and follow-ups stop.
6. Delete the test leads, then activate the workflow.

---

## 7. Compliance reminders

- Only auto-email leads that are **limited companies** or have given consent (PECR). Sole traders: use channel WhatsApp/Phone/Walk-in so they become manual tasks.
- Every email template must include the sender's name, company and the opt-out line. Anyone who replies STOP: set stage to **Do not contact** straight away.
- n8n must never send WhatsApp or Instagram messages automatically.

---

**Questions:** contact Kesav.
