# Admin Setup Guide (Supabase)

Run everything in the Supabase **SQL Editor**, one file at a time, in this order.
Open each file, copy all of it, paste, click **Run**, and wait for "Success" before the next one.

## 1. Database files (in `supabase/migrations/` unless stated)

| Order | File | Notes |
|---|---|---|
| 1 | `13_v2_schema_setup.sql` | Creates the v2 tables. Old v1 tables are renamed to `_legacy`. |
| 2 | `15_v2_functions_part1.sql` | |
| 3 | `16_v2_functions_part2.sql` | |
| 4 | `17_v2_functions_part3.sql` | |
| 5 | `18_v2_rls_policies.sql` | If it says "policy already exists", it was run before. Move on. |
| 6 | `19_v2_missing_pieces.sql` | |
| 7 | `20_v2_cadence_rules.sql` | |
| 8 | `21_v2_auth_trigger.sql` | New users get a profile automatically (role: sales). |
| 9 | `22_v2_fixes.sql` | Fixes from testing, plus the starter message templates. |
| 10 | `supabase/import_marketing_leads.sql` | All 152 real leads, as "Needs review". The last result shows counts per service and type. |

**Do not run:** `14_v2_data_migration.sql` (old v1 data) or `supabase/seed_sample_cafes.sql` (test data, it clashes with the real leads).

## 2. Turn off public sign-ups

In Supabase **Authentication settings**, turn off new user sign-ups so only people you invite can get in.
Every new user starts as a salesperson, so this matters.

## 3. Add yourself as admin

1. Supabase **Authentication > Users > Add user** (or Invite). Use your email.
2. In the SQL Editor run:

```sql
update "sales-pipe".profiles
set role = 'admin', full_name = 'Kesav'
where id = (select id from auth.users where email = 'YOUR EMAIL HERE');
```

## 4. Add salespeople and consultants

1. Add each person in **Authentication > Users**. They become `sales` automatically.
2. Set their name (used in message drafts as "I'm ... from Selfera"):

```sql
update "sales-pipe".profiles
set full_name = 'First Last'
where id = (select id from auth.users where email = 'THEIR EMAIL');
```

3. For a consultant, also set `role = 'consultant'`. To change how many active pitches a salesperson holds, set `capacity` (default 150).

## 5. Start sales work

1. Leads wait in the review queue as **Needs review**.
2. Approving a lead (review queue, or `select "sales-pipe".approve_import(array[...business ids...]);`):
   - creates a thread for each platform it has (Email, WhatsApp for 07 numbers, Phone for landlines, Instagram, Facebook, or Walk-in if nothing else)
   - assigns a salesperson (split evenly, least busy first)
   - drafts the first message from the templates, with the business and salesperson names filled in
3. The salesperson sees them in **Due today > New outreach**, reviews the draft and sends.

Approve a small batch first (10 to 20) to check drafts before approving everything.

## 6. Check it worked

```sql
select role, full_name from "sales-pipe".profiles;
select stage, count(*) from "sales-pipe".opportunities group by stage;
select count(*) as templates from "sales-pipe".templates;
```

Expected after setup: your admin row, 152 pitches in "Needs review", 34 templates.
