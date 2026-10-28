// Read-only structure snapshot of the "sales-pipe" schema. Usage: node snapshot.cjs <env file> <out.json>
const fs = require('fs')
const { Client } = require('/Users/kesavs/Automaitee/selfera-sales/node_modules/pg')
const [envFile, out] = process.argv.slice(2)
const cs = fs.readFileSync(envFile, 'utf8').split('\n').find(l => l.startsWith('DATABASE_URL=')).slice(13).trim().replace(/^["']|["']$/g, '')
const Q = require('./snapq.cjs')
;(async () => {
  const c = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } }); await c.connect()
  await c.query('BEGIN READ ONLY')
  const snap = {}
  for (const [k, q] of Object.entries(Q)) snap[k] = Object.fromEntries((await c.query(q)).rows.map(r => [r.n, r.d ?? r.k ?? '']))
  await c.query('ROLLBACK'); await c.end()
  fs.writeFileSync(out, JSON.stringify(snap, null, 1))
  console.log(envFile, Object.entries(snap).map(([k, v]) => `${k}:${Object.keys(v).length}`).join(' '))
})().catch(e => { console.error(envFile, 'FAILED:', e.message); process.exit(1) })
