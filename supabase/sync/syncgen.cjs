// Generates SQL that brings the "sales-pipe" structure of a target database in line
// with a source database (dev). Structure only: no rows are added, changed or removed.
// Usage: node syncgen.cjs <source env file> <target env file> <out.sql>
const fs = require('fs')
const { Client } = require('/Users/kesavs/Automaitee/selfera-sales/node_modules/pg')
const [srcEnv, dstEnv, out] = process.argv.slice(2)
const url = f => fs.readFileSync(f, 'utf8').split('\n').find(l => l.startsWith('DATABASE_URL=')).slice(13).trim().replace(/^["']|["']$/g, '')
const SCHEMA = 'sales-pipe'
const q = id => '"' + id.replace(/"/g, '""') + '"'
const T = t => `${q(SCHEMA)}.${q(t)}`

async function catalog(c) {
  const rows = async (sql) => (await c.query(sql)).rows
  const ns = `'"${SCHEMA}"'::regnamespace`
  return {
    tables: await rows(`select c.relname, c.relkind, c.relrowsecurity rls, c.relforcerowsecurity frls, c.relacl::text acl, c.reloptions from pg_class c where c.relnamespace=${ns} and c.relkind in ('r','v','S') order by 1`),
    columns: await rows(`select c.relname tbl, a.attname col, a.attnum, format_type(a.atttypid, a.atttypmod) typ, a.attnotnull nn, a.attgenerated gen,
                           pg_get_expr(d.adbin, d.adrelid) def
                         from pg_attribute a join pg_class c on c.oid=a.attrelid left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
                         where c.relnamespace=${ns} and c.relkind='r' and a.attnum>0 and not a.attisdropped order by c.relname, a.attnum`),
    constraints: await rows(`select c.relname tbl, k.conname, k.contype, pg_get_constraintdef(k.oid) def from pg_constraint k join pg_class c on c.oid=k.conrelid
                             where k.connamespace=${ns} and k.contype in ('p','u','c','f','x') order by 1,2`),
    indexes: await rows(`select i.indexname, i.tablename, i.indexdef from pg_indexes i where i.schemaname='${SCHEMA}'
                         and not exists (select 1 from pg_constraint k where k.connamespace=${ns} and k.conname=i.indexname) order by 1`),
    functions: await rows(`select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) args, pg_get_function_result(p.oid) result,
                             pg_get_functiondef(p.oid) def, p.proacl::text acl
                           from pg_proc p where p.pronamespace=${ns} and p.prokind in ('f','p') order by 2,3`),
    views: await rows(`select viewname, definition from pg_views where schemaname='${SCHEMA}'`),
    triggers: await rows(`select t.tgrelid::regclass::text tbl, t.tgname, pg_get_triggerdef(t.oid) def from pg_trigger t join pg_proc p on p.oid=t.tgfoid
                          where not t.tgisinternal and (t.tgrelid in (select oid from pg_class where relnamespace=${ns}) or p.pronamespace=${ns}) order by 1,2`),
    policies: await rows(`select tablename, policyname, permissive, roles::text[] roles, cmd, qual, with_check from pg_policies where schemaname='${SCHEMA}' order by 1,2`),
    sequences: await rows(`select sequencename, data_type, start_value, increment_by, min_value, max_value, cycle from pg_sequences where schemaname='${SCHEMA}'`),
    authTrigger: (await rows(`select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgname='on_auth_user_created'`)).length > 0,
    roles: new Set((await rows(`select rolname from pg_roles`)).map(r => r.rolname)),
  }
}

// aclitem text -> [{grantee, privs}]
function parseAcl(acl) {
  if (!acl) return null
  return acl.replace(/^\{|\}$/g, '').split(',').filter(Boolean).map(item => {
    const s = item.replace(/^"|"$/g, '')
    const [who, rest] = s.split('=')
    return { grantee: who || 'PUBLIC', privs: rest.split('/')[0] }
  })
}
const TABLE_PRIVS = { a: 'INSERT', r: 'SELECT', w: 'UPDATE', d: 'DELETE', D: 'TRUNCATE', x: 'REFERENCES', t: 'TRIGGER', m: 'MAINTAIN' }
const SEQ_PRIVS = { r: 'SELECT', w: 'UPDATE', U: 'USAGE' }

;(async () => {
  const src = new Client({ connectionString: url(srcEnv), ssl: { rejectUnauthorized: false } }); await src.connect()
  const dst = new Client({ connectionString: url(dstEnv), ssl: { rejectUnauthorized: false } }); await dst.connect()
  await src.query('BEGIN READ ONLY'); await dst.query('BEGIN READ ONLY')
  const S = await catalog(src), D = await catalog(dst)
  await src.query('ROLLBACK'); await dst.query('ROLLBACK'); await src.end(); await dst.end()

  const sql = []
  const say = (title) => sql.push(`\n-- ${'-'.repeat(76)}\n-- ${title}\n-- ${'-'.repeat(76)}`)
  const dTables = new Set(D.tables.map(t => t.relname))
  const sTables = new Set(S.tables.map(t => t.relname))
  const newTables = S.tables.filter(t => t.relkind === 'r' && !dTables.has(t.relname)).map(t => t.relname)
  const colSpec = c => `${q(c.col)} ${c.typ}${c.gen === 's' ? ` GENERATED ALWAYS AS (${c.def}) STORED` : c.def ? ` DEFAULT ${c.def}` : ''}${c.nn ? ' NOT NULL' : ''}`

  // 1. Sequences
  const dSeq = new Set(D.sequences.map(s => s.sequencename))
  const seqs = S.sequences.filter(s => !dSeq.has(s.sequencename))
  if (seqs.length) { say('Sequences'); for (const s of seqs) sql.push(`CREATE SEQUENCE IF NOT EXISTS ${T(s.sequencename)} AS ${s.data_type} START ${s.start_value} INCREMENT ${s.increment_by} MINVALUE ${s.min_value} MAXVALUE ${s.max_value}${s.cycle ? ' CYCLE' : ''};`) }

  // 2. New tables (columns only; constraints come after, once every table exists)
  if (newTables.length) {
    say(`New tables (${newTables.length})`)
    for (const t of newTables) sql.push(`CREATE TABLE IF NOT EXISTS ${T(t)} (\n    ${S.columns.filter(c => c.tbl === t).map(colSpec).join(',\n    ')}\n);`)
  }

  // 3. New columns on existing tables
  const dCols = new Set(D.columns.map(c => `${c.tbl}.${c.col}`))
  const addCols = S.columns.filter(c => dTables.has(c.tbl) && !dCols.has(`${c.tbl}.${c.col}`))
  if (addCols.length) { say(`New columns on existing tables (${addCols.length})`); for (const c of addCols) sql.push(`ALTER TABLE ${T(c.tbl)} ADD COLUMN IF NOT EXISTS ${colSpec(c)};`) }
  // Columns that exist on both but differ
  const sColMap = new Map(S.columns.map(c => [`${c.tbl}.${c.col}`, c]))
  const colChanges = D.columns.filter(c => sColMap.has(`${c.tbl}.${c.col}`)).flatMap(c => {
    const s = sColMap.get(`${c.tbl}.${c.col}`); const out = []
    if (s.typ !== c.typ) out.push(`ALTER TABLE ${T(c.tbl)} ALTER COLUMN ${q(c.col)} TYPE ${s.typ};`)
    if ((s.def || '') !== (c.def || '') && s.gen !== 's') out.push(s.def ? `ALTER TABLE ${T(c.tbl)} ALTER COLUMN ${q(c.col)} SET DEFAULT ${s.def};` : `ALTER TABLE ${T(c.tbl)} ALTER COLUMN ${q(c.col)} DROP DEFAULT;`)
    if (s.nn !== c.nn) out.push(`ALTER TABLE ${T(c.tbl)} ALTER COLUMN ${q(c.col)} ${s.nn ? 'SET' : 'DROP'} NOT NULL;`)
    return out
  })
  if (colChanges.length) { say(`Changed columns (${colChanges.length})`); sql.push(...colChanges) }

  // 4. Constraints: keys first, then checks, then foreign keys
  const dCon = new Map(D.constraints.map(k => [`${k.tbl}.${k.conname}`, k]))
  const sCon = new Map(S.constraints.map(k => [`${k.tbl}.${k.conname}`, k]))
  const conSql = []
  // Same rule under another name (e.g. a primary key called *_pkey1): rename to dev's name
  for (const k of D.constraints) {
    if (sCon.has(`${k.tbl}.${k.conname}`)) continue
    const twin = S.constraints.find(s => s.tbl === k.tbl && s.def === k.def && !dCon.has(`${s.tbl}.${s.conname}`))
    if (twin) { conSql.push(`ALTER TABLE ${T(k.tbl)} RENAME CONSTRAINT ${q(k.conname)} TO ${q(twin.conname)};`); dCon.set(`${twin.tbl}.${twin.conname}`, twin); dCon.delete(`${k.tbl}.${k.conname}`) }
  }
  const order = { p: 0, u: 1, x: 2, c: 3, f: 4 }
  const wanted = [...S.constraints].sort((a, b) => order[a.contype] - order[b.contype])
  for (const k of wanted) {
    const have = dCon.get(`${k.tbl}.${k.conname}`)
    if (have && have.def === k.def) continue
    if (have) conSql.push(`ALTER TABLE ${T(k.tbl)} DROP CONSTRAINT ${q(k.conname)};`)
    const existing = dTables.has(k.tbl)
    if (existing && (k.contype === 'c' || k.contype === 'f')) {
      // Existing rows are not touched: add the rule for new rows, then check old rows if they already fit
      conSql.push(`ALTER TABLE ${T(k.tbl)} ADD CONSTRAINT ${q(k.conname)} ${k.def} NOT VALID;`)
      conSql.push(`DO $v$ BEGIN ALTER TABLE ${T(k.tbl)} VALIDATE CONSTRAINT ${q(k.conname)}; EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE NOTICE 'Kept as NOT VALID (existing rows break it): %', '${k.tbl}.${k.conname}'; END $v$;`)
    } else conSql.push(`ALTER TABLE ${T(k.tbl)} ADD CONSTRAINT ${q(k.conname)} ${k.def};`)
  }
  // Constraints only on the target
  for (const k of D.constraints) if (!sCon.has(`${k.tbl}.${k.conname}`) && sTables.has(k.tbl)) conSql.unshift(`ALTER TABLE ${T(k.tbl)} DROP CONSTRAINT IF EXISTS ${q(k.conname)};`)
  if (conSql.length) { say(`Constraints (${conSql.length} statements)`); sql.push(...conSql) }

  // 5. Indexes
  const dIdx = new Map(D.constraints.map(k => [k.conname, 1]))
  const dIndex = new Map((await (async () => D.indexes)()).map(i => [i.indexname, i]))
  const idxSql = []
  for (const i of S.indexes) {
    const have = dIndex.get(i.indexname)
    if (have && have.indexdef === i.indexdef) continue
    if (have) idxSql.push(`DROP INDEX IF EXISTS ${T(i.indexname)};`)
    if (!dIdx.has(i.indexname)) idxSql.push(i.indexdef.replace(/^CREATE (UNIQUE )?INDEX /, 'CREATE $1INDEX IF NOT EXISTS ') + ';')
  }
  if (idxSql.length) { say(`Indexes (${idxSql.length})`); sql.push(...idxSql) }

  // 6. Functions (bodies are not checked at creation, so the order doesn't matter)
  const dFn = new Map(D.functions.map(f => [`${f.proname}(${f.args})`, f]))
  const sFn = new Map(S.functions.map(f => [`${f.proname}(${f.args})`, f]))
  const fnSql = []
  for (const f of D.functions) if (!sFn.has(`${f.proname}(${f.args})`)) fnSql.push(`DROP FUNCTION IF EXISTS ${T(f.proname)}(${f.args});`)
  for (const f of S.functions) {
    const have = dFn.get(`${f.proname}(${f.args})`)
    if (have && have.def === f.def) continue
    if (have && have.result !== f.result) fnSql.push(`DROP FUNCTION ${T(f.proname)}(${f.args});`)
    fnSql.push(f.def.trim() + ';')
  }
  if (fnSql.length) { say(`Functions (${fnSql.length} statements)`); sql.push(...fnSql) }

  // 7. Views
  const dView = new Map(D.views.map(v => [v.viewname, v]))
  const viewSql = []
  for (const v of S.views) {
    if (dView.get(v.viewname)?.definition === v.definition) continue
    const opts = S.tables.find(t => t.relname === v.viewname)?.reloptions
    viewSql.push(`CREATE OR REPLACE VIEW ${T(v.viewname)}${opts ? ` WITH (${opts.join(', ')})` : ''} AS\n${v.definition.trim()}`)
  }
  if (viewSql.length) { say('Views'); sql.push(...viewSql.map(s => s.replace(/;?$/, ';'))) }

  // 8. Triggers (including the Admin Panel access sync on hr / public tables)
  const dTrg = new Map(D.triggers.map(t => [`${t.tbl} ${t.tgname}`, t]))
  const sTrg = new Map(S.triggers.map(t => [`${t.tbl} ${t.tgname}`, t]))
  const trgSql = []
  for (const t of D.triggers) if (!sTrg.has(`${t.tbl} ${t.tgname}`) && t.tbl.includes(SCHEMA)) trgSql.push(`DROP TRIGGER IF EXISTS ${q(t.tgname)} ON ${t.tbl};`)
  for (const t of S.triggers) {
    if (dTrg.get(`${t.tbl} ${t.tgname}`)?.def === t.def) continue
    trgSql.push(`DROP TRIGGER IF EXISTS ${q(t.tgname)} ON ${t.tbl};`, t.def + ';')
  }
  if (S.authTrigger !== D.authTrigger && !S.authTrigger) {
    trgSql.push('-- People now get access from the Admin Panel access matrix, not on sign-up')
    trgSql.push('DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;', 'DROP FUNCTION IF EXISTS public.handle_new_user();')
  }
  if (trgSql.length) { say('Triggers'); sql.push(...trgSql) }

  // 9. Row level security and policies
  const rlsSql = []
  for (const t of S.tables.filter(t => t.relkind === 'r')) {
    const d = D.tables.find(x => x.relname === t.relname)
    if (!d || d.rls !== t.rls) rlsSql.push(`ALTER TABLE ${T(t.relname)} ${t.rls ? 'ENABLE' : 'DISABLE'} ROW LEVEL SECURITY;`)
    if ((d?.frls ?? false) !== t.frls) rlsSql.push(`ALTER TABLE ${T(t.relname)} ${t.frls ? 'FORCE' : 'NO FORCE'} ROW LEVEL SECURITY;`)
  }
  const polKey = p => `${p.tablename} ${p.policyname}`
  const polSig = p => JSON.stringify([p.permissive, p.roles, p.cmd, p.qual, p.with_check])
  const dPol = new Map(D.policies.map(p => [polKey(p), p]))
  const sPolKeys = new Set(S.policies.map(polKey))
  for (const p of D.policies) if (!sPolKeys.has(polKey(p))) rlsSql.push(`DROP POLICY IF EXISTS ${q(p.policyname)} ON ${T(p.tablename)};`)
  for (const p of S.policies) {
    const have = dPol.get(polKey(p))
    if (have && polSig(have) === polSig(p)) continue
    rlsSql.push(`DROP POLICY IF EXISTS ${q(p.policyname)} ON ${T(p.tablename)};`)
    rlsSql.push(`CREATE POLICY ${q(p.policyname)} ON ${T(p.tablename)} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.map(r => r === 'public' ? 'public' : q(r)).join(', ')}${p.qual ? ` USING (${p.qual})` : ''}${p.with_check ? ` WITH CHECK (${p.with_check})` : ''};`)
  }
  if (rlsSql.length) { say('Row level security and policies'); sql.push(...rlsSql) }

  // 10. Permissions: every table, view, sequence and function gets exactly dev's grants
  const grantSql = []
  const API_ROLES = ['PUBLIC', 'anon', 'authenticated', 'service_role']
  for (const t of S.tables) {
    const d = D.tables.find(x => x.relname === t.relname)
    if (d && d.acl === t.acl) continue
    const kind = t.relkind === 'S' ? 'SEQUENCE' : 'TABLE'
    const map = t.relkind === 'S' ? SEQ_PRIVS : TABLE_PRIVS
    grantSql.push(`REVOKE ALL ON ${kind} ${T(t.relname)} FROM ${API_ROLES.join(', ')};`)
    for (const a of parseAcl(t.acl) || []) {
      if (!API_ROLES.includes(a.grantee) || !D.roles.has(a.grantee) && a.grantee !== 'PUBLIC') continue
      const privs = [...a.privs.replace(/\*/g, '')].map(ch => map[ch]).filter(Boolean)
      if (privs.length) grantSql.push(`GRANT ${privs.join(', ')} ON ${kind} ${T(t.relname)} TO ${a.grantee === 'PUBLIC' ? 'PUBLIC' : a.grantee};`)
    }
  }
  for (const f of S.functions) {
    const d = dFn.get(`${f.proname}(${f.args})`)
    if (d && d.acl === f.acl && d.def === f.def) continue
    const sig = `${T(f.proname)}(${f.args})`
    const acl = parseAcl(f.acl)
    grantSql.push(`REVOKE ALL ON FUNCTION ${sig} FROM ${API_ROLES.join(', ')};`)
    const grantees = acl === null ? ['PUBLIC'] : acl.filter(a => a.privs.includes('X') && API_ROLES.includes(a.grantee)).map(a => a.grantee)
    for (const g of grantees) grantSql.push(`GRANT EXECUTE ON FUNCTION ${sig} TO ${g};`)
  }
  if (grantSql.length) { say(`Permissions (${grantSql.length} statements)`); sql.push(...grantSql) }

  const header = `-- ==============================================================================
-- Structure sync: makes the "${SCHEMA}" schema match dev.
-- Generated ${new Date().toISOString()} from the live dev database.
-- Structure only: no rows are added, changed or removed. Rules that existing
-- rows break are added as NOT VALID (checked for new rows only).
-- ==============================================================================

SET check_function_bodies = off;
SET search_path TO "${SCHEMA}", public;
`
  fs.writeFileSync(out, header + sql.join('\n') + '\n')
  console.log(`written ${out}: ${sql.filter(s => !s.startsWith('\n--')).length} statements`)
})().catch(e => { console.error('FAILED:', e.message); process.exit(1) })
