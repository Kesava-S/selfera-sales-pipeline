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
| `SEND_API_PLATFORMS` | server only | Platforms that send through n8n, e.g. `Email,WhatsApp`. Empty = every platform uses "Copy + open app, then Mark as sent" |
| `META_HUMAN_AGENT` | server only | `true` only if Meta approved the human agent tag (7-day reply window on Instagram / Facebook) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | for the website booking route (5.3) |

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
| `list_pitches(p_service, p_type, p_filter, p_search, p_platform, p_assigned, p_include_archived, p_limit, p_offset)` | every list screen | Paged, role-scoped list with platform statuses and total count |
| `import_businesses(p_rows)` / `find_duplicates(p_rows)` | Add business, CSV import | Saves as Needs review; one bad row never stops the rest |
| `add_note`, `start_thread`, `new_pitch` | business page | Note, start another platform, pitch another service |
| `assign_sales`, `set_services`, `set_archived` | admin bulk actions | No bulk messaging, by design |
| `insights(p_from, p_to, p_service, p_user)` | Insights page | Funnel, reply rate by platform and step, wins, templates. Admin can pick a person, others see their own |
| `save_template(p_id, p_step, p_service, p_platform, p_subject, p_body)` / `set_template_active(p_id, p_active)` | Templates page | Admin only. One template per step + service + platform. No delete (switch Off) |
| `set_my_name`, `update_member`, `set_cadence` | Settings page | Name for everyone; team and timing admin only. Inviting (`auth.admin.inviteUserByEmail`) and blocking log-in (`ban_duration`) use the service key in `actions.ts` |
| `record_inbound(...)` | **n8n only** | Incoming message: pauses other platforms, discards old drafts, STOP = Do not contact |
| `daily_update()` | **n8n only**, 09:00 Mon to Fri | Drafts due follow-ups, marks No reply / Went cold / No response, upsell reminders. Sends nothing |

Automatic: new website bookings are matched by phone or email (trigger), and new users get a `sales` profile (trigger).

---

## 5. What's done and what's left

### 5.1 Done and tested (local Postgres + PostgREST, logged in as admin, two salespeople and a consultant)
- **Getting leads in:** Add business form (with duplicate check), CSV import in 4 steps (column matching, type mapping, error rows download, duplicates: skip / update / new pitch), `public/import-template.csv`, review queue with Approve (single or selected).
- **Lead Management:** minimal table (Business, Platforms reached, Next due), expand row, show more columns, filters, paging, admin bulk Assign / Change services / Archive / Export CSV.
- **Home:** Due today (New outreach, Follow-ups, Replies), status boxes (admin also Needs consultant, Unmatched bookings), service boxes, review queue banner, empty state.
- **Drill-down:** service > business type > business cards with filter chips, status pages, Needs consultant queue, Unmatched bookings linking.
- **Business page:** platform boxes, start another platform, Change stage, Hand over, Record win (works out As pitched / Expanded / Narrowed / Switched), Assign consultant, Add note, New pitch, Edit details, history.
- **Chat:** step indicator, drafts filled with business and salesperson names, template picker, the right button per platform (`src/lib/sending.ts`), Copy + open app, Mark as sent, Phone / Walk-in Mark as done, PECR confirm, 24-hour window messages, read-only after hand-over, opted out blocked, live updates.
- **Sending route** `/api/send`: checks again on the server (access, window, PECR, placeholders, opted out), sends through n8n, then records. If n8n fails nothing is recorded and the text stays.
- **Insights:** date range (last 30 days by default), service, person (admin). Five numbers, funnel, reply rate by platform and by step, wins, templates (under 10 sends shows "Too few to judge"). Phone and Walk-in show "Not tracked" because call outcomes are notes, not replies.
- **Templates:** tabs by message type, filters for service and platform, On/Off switch, edit subject (Email and All platforms) and body with placeholder buttons. Admin edits, others view. Most specific template wins, service first: service + platform > service + All platforms > General + platform > General + All platforms (drafts and the chat picker). "All platforms" covers WhatsApp, Instagram, Facebook and Email only; Phone and Walk-in use their own notes. Templates describe clients anonymously, never by name.
- **Settings:** my name (everyone). Admin: team list with emails, Add person (invite email, lands on `/auth/set-password`), edit name, role, active lead limit, switch off (also blocks log-in). Can't remove your own admin access, and one admin always stays. Follow-up timing for the 3 steps. The 14 working days after the Final check is still fixed in `record_outbound` and `daily_update`.
- **Top bar:** notification bell (live), log out. Login is invite only (no sign-up button).
- **Database:** every change goes through checked functions; staff can only read and change what they are assigned (plus the unassigned review queue for salespeople).

### 5.2 Connect the platforms (next step)
- **n8n "Send" webhook** (`N8N_WEBHOOK_URL`, header `Authorization: Bearer N8N_WEBHOOK_SECRET`).
  - **Receives:** `{ platform, to, threadId, externalThreadId, body, subject, templateName, sentBy }`.
  - **Must reply:** `{ ok: true, message_id }`, or `{ ok: false, error }`.
  - **Must only send:** the app records the message itself, so update `v2-outbound-sender.json` and remove its "Record Outbound" node.
- **Turn platforms on:** add each one to `SEND_API_PLATFORMS` as it is connected.
- **Inbound:** WhatsApp and Instagram exist in n8n. Add **Facebook** and **Email**. All call `record_inbound` with the service key.
- **Echoes:** messages sent from the phone apps can arrive as "echo" events. Ignore them (the salesperson already clicked Mark as sent).
- **WhatsApp first contact:** needs Meta-approved templates. Put the approved name in the template's `whatsapp_template_name`.
- **Old workflow:** delete `n8n/sales-follow-ups-daily.json` (v1).

### 5.3 Website booking form (selfera.co.uk)
- Add `POST /api/bookings`. The middleware already lets it through without a login.
- **The route:** checks a shared secret, then inserts into `consultation_bookings` using `createServiceClient()`.
- **Fields:** `name`, `business_name`, `email`, `phone`, `booked_for`, `message`.
- **Matching is automatic** (trigger).

### 5.4 Clean-up still open
- `src/lib/supabase/middleware.ts` skips the login check when `NODE_ENV` is `development` (a mock user). Pages still check the login, but remove this before go-live.
- `supabase/migrations/merged_for_live.sql` holds older function versions. Do not run it after 24 or 25 (it would undo them). Delete it at the end.
- `next.config.ts` has `typescript.ignoreBuildErrors: true`, an `eslint` key that Next 16 no longer accepts, and a v1 rewrite for `/leads/:id`.
  - Remove all three, so build errors are not hidden.
  - The app builds cleanly without them.
- **Old v1 components** are no longer used. Delete them after a final check: `TodayTasksView`, `LeadsView`, `LeadDetailView`, `CompanyLeadsView`, `AddLeadView`, `AddLeadModal`, `AddLeadModalProvider`, `EditLeadModal`, `SendFollowupModal`, `ReplyChannelModal`, `ChangeServiceModal`, `TemplatesView` (the one in `src/components/`, not `v2/`), `TemplateModal`, `CompanyAutocompleteInput`, `EnvWarningBanner`.

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
