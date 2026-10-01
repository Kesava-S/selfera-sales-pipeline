# Selfera Sales Dashboard: Developer Guide

A sales tool for Selfera. Staff reach out to small businesses on several platforms, track every reply, and hand interested leads to a consultant.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres, Auth, Realtime) · n8n · Vercel

---

## 1. Ground rules (do not break these)

1. **No automatic messages, ever.** A message is only sent when a person clicks Send. No bulk or scheduled sending.
2. **Business rules live in the database.** The app and n8n call database functions. Never repeat stage or date logic in the front end.
3. **All counts come from the database** (functions below), never from counting rows in the browser.
4. **The service role key stays on the server** (API routes and n8n). The browser only uses the anon key.
5. UK English, UK dates (`30 Sep 2026`, `21:04`, Europe/London), no em dashes, no "AI" wording in the UI.

---

## 2. Run it

### Environment variables (`.env.local`, and in Vercel)

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | |
| `NEXT_PUBLIC_SUPABASE_SCHEMA` | browser + server | `sales-pipe` |
| `N8N_WEBHOOK_URL` | server only | n8n "Send" webhook |
| `N8N_WEBHOOK_SECRET` | server only | shared secret checked by n8n |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | **to add**, for the website booking route (4.9) |
| `NEXT_PUBLIC_DEMO_MODE` | local only | `true` runs on sample data with no Supabase. **Never set in Vercel.** Remove it to use the real database. |

### Database
Follow `docs/admin-setup.md` (run order, first admin, adding staff). Then:
```
npm install
npm run dev
```

---

## 3. How the data fits together

```
businesses ─┬─ opportunities (a "pitch": services pitched, stage, assigned people)
            │     └─ threads (one per platform: WhatsApp, Instagram, Facebook, Email, Phone, Walk-in)
            │           ├─ messages (outbound / inbound / system)
            │           └─ drafts (prepared from templates, waiting for Send)
            └─ consultation_bookings (from the website form, matched automatically)
profiles (role: admin, sales, consultant) · templates · stage_changes · notifications · cadence_rules
```

- **Stages:** Needs review → Active → Interested → Consultation → Won. Or: Went cold, No response, Declined, Do not contact.
- **Thread status:** Not contacted → Awaiting reply → Replied. Or: Paused, No reply, Opted out.
- **Cadence (working days):** First contact → +3 → Follow-up 1 → +5 → Follow-up 2 → +14 → Final check → No reply after 14.
- **A reply on one platform pauses the others** ("Paused: replied on WhatsApp").

---

## 4. Database functions (call these, don't rebuild them)

Call with `supabase.rpc('<name>', { ... })`. Access checks are inside each function.

| Function | Who calls it | When |
|---|---|---|
| `approve_import(p_business_ids)` | review queue | Approve leads: creates threads, assigns a salesperson, drafts first messages |
| `record_outbound(p_thread_id, p_body, p_subject, p_template_id, p_send_method, p_external_message_id, p_sent_by)` | `/api/send` or n8n | After a message is sent. `p_send_method`: `api` or `manual` |
| `set_stage(p_opportunity_id, p_stage, p_reason, p_user_id)` | business page | Change stage |
| `hand_over(p_opportunity_id, p_consultation_at, p_user_id)` | business page | Move to Consultation |
| `record_win(p_opportunity_id, p_services_won, p_converted_through, p_user_id)` | business page | Mark won. Works out Expanded / Switched and so on |
| `assign_consultant(p_opportunity_id, p_consultant_id)` | admin | Assign a consultant |
| `link_booking(p_booking_id, p_opportunity_id)` | admin | Link an unmatched website booking |
| `v_dashboard_status_counts(p_user)` | home | Status boxes |
| `v_service_counts(p_user)` | home | Service boxes |
| `v_business_type_counts(p_service, p_user)` | service page | Type boxes |
| `v_business_cards(p_service, p_type, p_filter, p_search, p_limit, p_offset)` | business list | Paged cards with platform statuses |
| `v_due_today(p_tab, p_limit, p_offset)` | home | Tabs: `New outreach`, `Follow-ups`, `Replies` |
| `record_inbound(...)` | **n8n only** | Incoming message |
| `daily_update()` | **n8n only**, 09:00 Mon to Fri | Drafts due follow-ups, marks No reply / Went cold / No response, upsell reminders. Sends nothing |

Automatic: new website bookings are matched by phone or email (trigger), and new users get a `sales` profile (trigger).

---

## 5. What's done and what's left

**Done:** database (migrations 13 to 22, tested), 152 real leads imported, login and route protection, demo mode, drill-down pages load real data, breadcrumbs, basic chat view.

Insights, Templates and Settings screens are **not in scope yet** (still being planned).

### 5.1 Must fix first (things are broken)
1. **Wrong column names.** The chat page and Lead Management query `phone_number`, `email_address`, `instagram_handle`. The real columns are `phone`, `email`, `instagram`.
2. **CSV import saves nothing.** `/api/leads/import` uses the wrong columns and sends an empty `services_pitched`, which the database rejects. It also assigns every lead to the importer. See 5.4.
3. **Our own messages are invisible in chat.** The bubble uses `var(--accent)`, which isn't defined.
4. **Platform dots are always grey** on business cards. They check `due`/`sent`/`replied`. Use the real thread statuses (section 3).
5. **Sidebar** polls the old `tasks` table every 15 seconds. Remove it.
6. **Layout** falls back to `test@example.com`. Remove that.

### 5.2 Home
- Add the **status row**: Needs reply · Interested · Consultation · Went cold · No response. Admins also see Needs consultant · Unmatched bookings. The data is already loaded, just not shown.
- Clicking a status box opens the business list filtered by that status.
- Due today items need an **Open** button and a platform icon. Consider switching to `v_due_today`.
- Remove the empty "Performance" column.

### 5.3 Service, type and business pages
- **Service page:** breadcrumb shows "Workspace". Set it to `Dashboard › Website`.
- **Business list:** use filter **chips** (All · Needs reply · Interested · Went cold · No response) instead of the dropdown.
- **Business page:**
  - Platform **boxes** with status colour, "Step X of 4" and the paused label.
  - Show services pitched and won, assigned salesperson and consultant, and other pitches for the same business.
- **Business page buttons:**
  - Change stage → `set_stage`
  - Hand over (date and time) → `hand_over`
  - Record win (services multi-select + converted through) → `record_win`
  - Add note → insert a `system` message
  - New pitch → new `opportunities` row with stage `Needs review`
  - Admin: Assign consultant → `assign_consultant`

### 5.4 Lead Management
- **Table:** minimal columns **Business · Platforms reached · Next due**. Expand arrow per row for the rest. "Show more columns" option.
- **Filters:** type, service, stage, platform, assigned to. Paged.
- **Admin bulk actions:** Assign · Change services pitched · Archive · Export CSV. **No bulk messaging.**
- **Add business** form.
- **Review queue** for `Needs review` rows: fix missing data, then **Approve** (single or selected) → `approve_import`.
- **CSV import in 4 steps:**
  1. Upload with column mapping.
  2. Check errors.
  3. Duplicates (by phone, email, or name + postcode): Skip / Update details / Add new pitch.
  4. Save as `Needs review`.
  - Add `public/import-template.csv`.
  - Required columns: `business_name`, `business_type`, `services_to_pitch` (`;` separated).

### 5.5 Chat view
- **Step indicator:** First contact ✓ · Follow-up 1 ✓ · Follow-up 2 ○ · Final check ○.
- **Pre-fill the composer** with the open draft. The database has already filled in `{business_name}` and `{sender_name}`.
- Change the hint to: "Draft from template. Review before sending."
- **Right button per platform:**
  - Email: **Send**
  - WhatsApp:
    - **Send** within 24 hours of their last message
    - otherwise **Send template** if the template has a `whatsapp_template_name`
    - otherwise **Copy + Open WhatsApp** (`https://wa.me/44...?text=...`), then **Mark as sent**
  - Instagram / Facebook: **Send** within 24 hours, otherwise **Copy + Open app**, then **Mark as sent**
  - Phone / Walk-in: **Mark as done** with a note
  - "Mark as sent" and "Mark as done" call `record_outbound` with `p_send_method = 'manual'`.
- **Messages to show:**
  - "Window closed, reply in the app" when the API can't send.
  - For sole trader + Email: "Sole traders need prior consent for marketing emails (PECR). Continue only if they agreed."
- **Live updates:** Supabase Realtime on `messages` for the open thread.

### 5.6 Top bar
- **Notification bell:** unread count, list, mark as read, click opens `link`.
- **Types:** `new_reply`, `booking_matched`, `booking_unmatched`, `needs_consultant`, `assigned_to_you`, `upsell_due`.

### 5.7 Sending (`/api/send`)
- **Already built:** it checks the user, forwards to n8n, and keeps the webhook secret server-side.
- **n8n "Send" workflow:** add the Instagram, Facebook and Email branches. Only WhatsApp exists now. It must call `record_outbound` after a successful send.
- **On failure:** return the error to the app and keep the draft.

### 5.8 n8n
- **Inbound:** WhatsApp and Instagram exist. Add **Facebook** and **Email**. All call `record_inbound` with the service key.
- **Echoes:** messages sent from the phone apps can arrive as "echo" events. Store them as outbound with `send_method = manual`, and don't count them as replies.
- **Daily:** `v2-daily-cron.json` calls `daily_update()`. Check it runs at 09:00 Europe/London.
- **Old workflow:** delete `sales-follow-ups-daily.json` (it's for v1).

### 5.9 Website booking form (selfera.co.uk)
- Add a server route, e.g. `POST /api/bookings`. It checks a shared secret, then inserts into `consultation_bookings` with the **service role key**.
- **Fields:** `name`, `business_name`, `email`, `phone`, `booked_for`, `message`.
- **The website must never write with the anon key.**
- **Matching is automatic** (trigger). A match moves the pitch to Consultation and notifies the admin and the salesperson.

### 5.10 Clean-up
- **Delete the old v1 components** that are no longer used: `TodayTasksView`, `LeadsView`, `LeadDetailView`, `CompanyLeadsView`, `AddLeadView`, `AddLeadModal`, `EditLeadModal`, `SendFollowupModal`, `ReplyChannelModal`, `ChangeServiceModal`, `TemplatesView`, `TemplateModal`, `CompanyAutocompleteInput`. Check each one before deleting.
- **Remove `@types/pg` and `pg`** from `package.json` if nothing uses them.
- **Don't run `supabase/seed_sample_cafes.sql` on the real database.** It clashes with the real leads.

---

## 6. Test before go-live

1. Logged out, every page goes to `/login`.
2. The anon key can't read tables or call functions (try `rpc('approve_import')` with no login: permission denied).
3. A user with no profile sees "Your account isn't set up yet".
4. **Approving 5 leads:**
   - threads appear for each available platform (WhatsApp only for 07 numbers)
   - leads are split across salespeople
   - drafts have the business and salesperson names filled in
5. Salesperson A can't open or change salesperson B's businesses.
6. Send moves the thread to "Awaiting reply" with the next due date. Mark as sent does the same.
7. A reply (via n8n) on WhatsApp pauses Instagram with "Paused: replied on WhatsApp", and the bell shows it.
8. A website booking with a known phone moves the pitch to Consultation and shows under Needs consultant.
9. Home, service and list numbers agree with each other.
10. `npm run build` passes. Screens work at 1440px and 375px.
