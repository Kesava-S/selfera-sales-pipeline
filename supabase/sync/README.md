# Structure sync (dev → staging / production)

The migration files in `supabase/migrations` no longer describe the live dev
database exactly, so staging and production are synced from dev's **live
structure** instead. Structure only: no rows are added, changed or removed.

1. Snapshot dev: `node supabase/sync/snapshot.cjs .env.local /tmp/snap_dev.json`
2. Generate: `node supabase/sync/syncgen.cjs .env.local .env.production supabase/sync/sync_production.sql`
3. Dry run (one transaction, compared with dev, rolled back):
   `node supabase/sync/applysync.cjs .env.production supabase/sync/sync_production.sql /tmp/snap_dev.json`
4. Apply (commits only if nothing differs from dev): add `--commit`.

Rules that existing rows break are added as NOT VALID (enforced for new rows only).

| Target | Status |
|---|---|
| Staging | Synced 2026-10-28. Kept `import_businesses(p_rows jsonb)` while production still copies imports to staging. |
| Production | `sync_production.sql` generated, **not applied**. Run it together with deploying the matching app code. |
