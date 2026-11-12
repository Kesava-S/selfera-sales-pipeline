# Database migrations ("sales-pipe" schema)

| What | Where | Use it for |
|---|---|---|
| New changes | `NN_name.sql` (from 77) | Changes not yet in every environment. Move to `archive/` once dev, staging and production all have it. |
| Old change history | `archive/NN_name.sql` (01 … 76) | Already applied everywhere. Kept for reference only; don't run again. |
| Whole structure, one file | `parent_migration.sql` | Building a new, empty database in one go. |
| One file per table | `schema/tables/<table>.sql` | Reading or reviewing one table: columns, keys, indexes, row rules, triggers, grants. |
| Functions, views, sequences | `schema/functions/`, `schema/views/`, `schema/sequences.sql` | The same, for database functions and views. |
| Starting rows | `schema/seed.sql` | Business types, services, platforms and follow-up timings for a new database. |

`parent_migration.sql` and everything in `schema/` are **generated** from the dev database. Don't edit them by hand.

## Making a change

1. Write the next numbered file, for example `77_what_it_does.sql`. Keep it safe to run once (`IF NOT EXISTS`, `CREATE OR REPLACE`), wrap it in `BEGIN; … COMMIT;` and end with `NOTIFY pgrst, 'reload schema';`.
2. Apply it to dev and test.
3. Regenerate the structure files:
   ```bash
   npm run db:schema
   ```
4. Apply the same numbered file to staging, then production.
5. Commit the numbered file and the regenerated files together.
6. Once every environment has it, move the numbered file into `archive/`.

## New database

Run `parent_migration.sql` once (Supabase SQL editor, or `psql`). It needs Supabase's `auth` schema (profiles link to `auth.users`) and the `supabase_realtime` publication. Integration keys (WhatsApp, email) are not included: add them on the Integrations page.

## Scheduled jobs (cron)

Migration 77 schedules the jobs in each database: consultation reminders, replies waiting, stuck campaign sends (all inside the database), plus the app calls: Meta template status, the campaign queue and email sync. The app calls read the app address and cron secret from Supabase Vault. Set them once per environment:

```bash
node scripts/db/sync-cron.cjs .env.staging https://<staging app address>
```

The secret is `CRON_SECRET` from that env file, or else its `SUPABASE_SERVICE_ROLE_KEY`: whatever the app on that address accepts.

## Certificates

The generator checks the database certificate. Supabase uses its own CA: download it (Dashboard → Database → SSL certificate) and set `DB_SSL_CA=/path/to/prod-ca.crt`. For a quick local run, `DB_SSL_NO_VERIFY=1` skips the check.
