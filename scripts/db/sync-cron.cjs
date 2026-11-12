#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Points one environment's scheduled jobs (migration 77) at its app:
// stores the app address and the cron secret in Supabase Vault
// ('sales_app_url', 'sales_cron_secret'). Nothing secret is printed.
//
// Usage: node scripts/db/sync-cron.cjs <env file> <app url>
//   e.g. node scripts/db/sync-cron.cjs .env.staging https://selfera-sales-staging.vercel.app
// The secret is CRON_SECRET from the env file, or else SUPABASE_SERVICE_ROLE_KEY:
// the same value the app accepts (see src/app/api/campaigns/process/route.ts).
// Certificates: set DB_SSL_CA=<Supabase CA file>, or DB_SSL_NO_VERIFY=1 for a local run.

const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

const [envFile, appUrl] = process.argv.slice(2)
if (!envFile || !/^https:\/\/[a-z0-9.-]+(\/)?$/i.test(appUrl || '')) {
  console.error('Usage: node scripts/db/sync-cron.cjs <env file> <https://app-url>')
  process.exit(1)
}
const env = Object.fromEntries(fs.readFileSync(path.resolve(envFile), 'utf8').split('\n')
  .filter(l => /^[A-Z0-9_]+=/.test(l))
  .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]))
const secret = env.CRON_SECRET || env.SUPABASE_SERVICE_ROLE_KEY
if (!env.DATABASE_URL || !secret) { console.error(`${envFile} needs DATABASE_URL and CRON_SECRET or SUPABASE_SERVICE_ROLE_KEY`); process.exit(1) }

const ssl = process.env.DB_SSL_CA ? { ca: fs.readFileSync(process.env.DB_SSL_CA, 'utf8') }
  : process.env.DB_SSL_NO_VERIFY === '1' ? { rejectUnauthorized: false } : true

;(async () => {
  const c = new Client({ connectionString: env.DATABASE_URL, ssl })
  await c.connect()
  const put = async (name, value, description) => {
    const { rows } = await c.query('SELECT id FROM vault.secrets WHERE name = $1', [name])
    if (rows.length) await c.query('SELECT vault.update_secret($1, $2)', [rows[0].id, value])
    else await c.query('SELECT vault.create_secret($1, $2, $3)', [value, name, description])
  }
  await put('sales_app_url', appUrl.replace(/\/$/, ''), 'Sales Pipeline app address for scheduled jobs')
  await put('sales_cron_secret', secret, 'Bearer secret the Sales Pipeline app accepts from scheduled jobs')
  const { rows } = await c.query(`SELECT jobname, schedule, active FROM cron.job ORDER BY jobname`).catch(() => ({ rows: [] }))
  console.log(`Vault secrets set for ${appUrl}. Jobs: ${rows.map(r => `${r.jobname} (${r.schedule}${r.active ? '' : ', off'})`).join(', ') || 'none yet (apply migration 77)'}`)
  await c.end()
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
