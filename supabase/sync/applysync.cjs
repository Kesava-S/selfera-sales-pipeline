// Applies a sync script to a target database in ONE transaction, then compares the
// resulting structure with dev's (inside the same transaction). Rolls back unless
// --commit is given AND nothing differs.
// Usage: node applysync.cjs <target env> <sync.sql> <dev snapshot.json> [--commit]
const fs = require('fs')
const { Client } = require('/Users/kesavs/Automaitee/selfera-sales/node_modules/pg')
const Q = require('./snapq.cjs')
const [envFile, sqlFile, devSnap, flag] = process.argv.slice(2)
const commit = flag === '--commit'
const cs = fs.readFileSync(envFile, 'utf8').split('\n').find(l => l.startsWith('DATABASE_URL=')).slice(13).trim().replace(/^["']|["']$/g, '')
const dev = JSON.parse(fs.readFileSync(devSnap, 'utf8'))
const IGNORE = new Set(['counts', 'extra_schemas', 'admin_tables'])
// Objects allowed to stay on the target (kept on purpose), from ALLOW_EXTRA=a;b
const ALLOW = new Set((process.env.ALLOW_EXTRA || '').split(';').filter(Boolean))
;(async () => {
  const c = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } })
  const notices = []
  c.on('notice', n => notices.push(n.message))
  await c.connect()
  await c.query('BEGIN')
  try {
    await c.query(fs.readFileSync(sqlFile, 'utf8'))
    console.log('script ran without errors')
    // Read back with the default search path, like the dev snapshot
    await c.query('RESET search_path')
    const now = {}
    for (const [k, q] of Object.entries(Q)) now[k] = Object.fromEntries((await c.query(q)).rows.map(r => [r.n, r.d ?? r.k ?? '']))
    let diffs = 0
    for (const k of Object.keys(dev)) {
      if (IGNORE.has(k)) continue
      // Permission lists can come back in any order
      const norm = v => { const t = String(v).replace(/ NOT VALID$/, ''); return /^\{.*\}$/.test(t) ? t.slice(1, -1).split(',').sort().join(',') : t }
      const missing = Object.keys(dev[k]).filter(x => !(x in now[k]))
      const extra = Object.keys(now[k]).filter(x => !(x in dev[k]) && !ALLOW.has(x))
      const differ = Object.keys(dev[k]).filter(x => x in now[k] && norm(dev[k][x]) !== norm(now[k][x]))
      if (missing.length + extra.length + differ.length) {
        diffs += missing.length + extra.length + differ.length
        console.log(`  ${k}: missing ${JSON.stringify(missing.slice(0, 8))} extra ${JSON.stringify(extra.slice(0, 8))} differ ${JSON.stringify(differ.slice(0, 8))}`)
        for (const x of differ.slice(0, 3)) console.log(`     ${x}\n       dev: ${dev[k][x]}\n       now: ${now[k][x]}`)
      }
    }
    const notValid = Object.entries(now.constraints).filter(([, d]) => d.endsWith('NOT VALID')).map(([n]) => n)
    console.log(`structure differences from dev after the script: ${diffs}`)
    if (notValid.length) console.log('rules kept as NOT VALID (existing rows break them):', notValid.join(', '))
    if (commit && diffs === 0) { await c.query('COMMIT'); console.log('COMMITTED') }
    else { await c.query('ROLLBACK'); console.log(commit ? 'ROLLED BACK (differences remain)' : 'DRY RUN: rolled back, nothing kept') }
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {})
    console.log('FAILED, rolled back:', e.message, e.where ? `\n  at: ${e.where}` : '', e.position ? `\n  position: ${e.position}` : '')
  } finally {
    if (notices.length) console.log('notices:', [...new Set(notices)].slice(0, 10).join(' | '))
    await c.end()
  }
})()
