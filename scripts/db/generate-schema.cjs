#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Regenerates the schema files from a live database (dev by default):
//   supabase/migrations/parent_migration.sql      the whole "sales-pipe" structure, in a safe order
//   supabase/migrations/schema/tables/<t>.sql      one file per table
//   supabase/migrations/schema/functions/<f>.sql   one file per function
//   supabase/migrations/schema/views/<v>.sql       one file per view
//   supabase/migrations/schema/sequences.sql, seed.sql
//
// Usage: node scripts/db/generate-schema.cjs [.env.local]
// Reads DATABASE_URL from the env file; never prints it. Read-only on the database.

const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

const SCHEMA = 'sales-pipe'
const Q = `"${SCHEMA}"`
const ROOT = path.join(__dirname, '..', '..')
const OUT = path.join(ROOT, 'supabase', 'migrations')
const OUT_SCHEMA = path.join(OUT, 'schema')
// Small lookup tables whose rows a fresh database needs (no secrets: settings and integrations are left out)
const SEED_TABLES = ['business_categories', 'services', 'outreach_platforms', 'cadence_rules']

const envFile = process.argv[2] || '.env.local'
const line = fs.readFileSync(path.join(ROOT, envFile), 'utf8').split('\n').find(l => /^DATABASE_URL=/.test(l))
if (!line) throw new Error(`No DATABASE_URL in ${envFile}`)
const url = line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')

const ident = s => `"${String(s).replace(/"/g, '""')}"`
const qn = name => `${Q}.${ident(name)}`
const PRIV = { r: 'SELECT', a: 'INSERT', w: 'UPDATE', d: 'DELETE', D: 'TRUNCATE', x: 'REFERENCES', t: 'TRIGGER', X: 'EXECUTE', U: 'USAGE', C: 'CREATE', m: 'MAINTAIN' }

// "{anon=rw/postgres,...}" -> [{ grantee, privs: [...] }] (owner and postgres skipped)
function parseAcl(acl) {
  if (!acl) return []
  return String(acl).replace(/^\{|\}$/g, '').split(',').filter(Boolean).flatMap(item => {
    const m = item.replace(/^"|"$/g, '').match(/^(.*)=([a-zA-Z*]*)\/(.*)$/)
    if (!m) return []
    const grantee = m[1] || 'PUBLIC'
    if (grantee === 'postgres' || grantee === 'supabase_admin') return []
    const privs = [...m[2].replace(/\*/g, '')].map(c => PRIV[c]).filter(Boolean)
    return privs.length ? [{ grantee, privs }] : []
  })
}
const grantee = g => (g === 'PUBLIC' ? 'PUBLIC' : ident(g))

;(async () => {
  // Certificates are checked. Supabase signs with its own CA: download it (Dashboard → Database →
  // SSL certificate) and set DB_SSL_CA=<path>. DB_SSL_NO_VERIFY=1 skips the check (local use only).
  const ssl = process.env.DB_SSL_CA ? { ca: fs.readFileSync(process.env.DB_SSL_CA, 'utf8') }
    : process.env.DB_SSL_NO_VERIFY === '1' ? { rejectUnauthorized: false } : true
  const c = new Client({ connectionString: url, ssl })
  await c.connect()
  await c.query('SET search_path TO DEFAULT')
  const q = async (sql, args = []) => (await c.query(sql, args)).rows

  // ---------- read the catalog ----------
  const [ns] = await q(`SELECT oid, nspacl::text AS acl FROM pg_namespace WHERE nspname = $1`, [SCHEMA])
  const tables = await q(`SELECT c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity, c.relacl::text AS acl,
      obj_description(c.oid, 'pg_class') AS comment
    FROM pg_class c WHERE c.relnamespace = $1 AND c.relkind = 'r' ORDER BY c.relname`, [ns.oid])
  const columns = await q(`SELECT a.attrelid, a.attname, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull, a.attgenerated,
      pg_get_expr(d.adbin, d.adrelid) AS def, col_description(a.attrelid, a.attnum) AS comment
    FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE c.relnamespace = $1 AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY a.attrelid, a.attnum`, [ns.oid])
  const constraints = await q(`SELECT conrelid, conname, contype, pg_get_constraintdef(oid) AS def
    FROM pg_constraint WHERE connamespace = $1 AND conrelid <> 0 AND contype <> 't' -- constraint triggers come with the triggers
    ORDER BY conrelid, CASE contype WHEN 'p' THEN 0 WHEN 'u' THEN 1 WHEN 'c' THEN 2 WHEN 'x' THEN 3 ELSE 4 END, conname`, [ns.oid])
  const indexes = await q(`SELECT i.indrelid, ic.relname, pg_get_indexdef(i.indexrelid) AS def
    FROM pg_index i JOIN pg_class ic ON ic.oid = i.indexrelid JOIN pg_class t ON t.oid = i.indrelid
    WHERE t.relnamespace = $1 AND t.relkind = 'r'
      AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = i.indexrelid)
    ORDER BY ic.relname`, [ns.oid])
  const policies = await q(`SELECT p.polrelid, p.polname, p.polcmd, p.polpermissive,
      CASE WHEN p.polroles = '{0}' THEN ARRAY['PUBLIC'] ELSE ARRAY(SELECT rolname::text FROM pg_roles WHERE oid = ANY(p.polroles) ORDER BY rolname) END::text[] AS roles,
      pg_get_expr(p.polqual, p.polrelid) AS qual, pg_get_expr(p.polwithcheck, p.polrelid) AS chk
    FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid WHERE c.relnamespace = $1 ORDER BY p.polname`, [ns.oid])
  const triggers = await q(`SELECT t.tgrelid, t.tgname, pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE c.relnamespace = $1 AND NOT t.tgisinternal ORDER BY t.tgname`, [ns.oid])
  const pub = new Set((await q(`SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = $1`, [SCHEMA])).map(r => r.tablename))
  const sequences = await q(`SELECT c.relname, s.seqstart, s.seqincrement, s.seqmin, s.seqmax, s.seqcache, s.seqcycle, c.relacl::text AS acl
    FROM pg_class c JOIN pg_sequence s ON s.seqrelid = c.oid WHERE c.relnamespace = $1 ORDER BY c.relname`, [ns.oid])
  const views = await q(`SELECT c.relname, pg_get_viewdef(c.oid, true) AS def, c.reloptions, c.relacl::text AS acl
    FROM pg_class c WHERE c.relnamespace = $1 AND c.relkind = 'v' ORDER BY c.relname`, [ns.oid])
  const functions = await q(`SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, pg_get_functiondef(p.oid) AS def,
      p.proacl::text AS acl, obj_description(p.oid, 'pg_proc') AS comment
    FROM pg_proc p WHERE p.pronamespace = $1 ORDER BY p.proname, args`, [ns.oid])
  const defaultAcl = await q(`SELECT defaclrole::regrole::text AS role, defaclobjtype AS kind, defaclacl::text AS acl
    FROM pg_default_acl WHERE defaclnamespace = $1 ORDER BY defaclobjtype`, [ns.oid])
  const seeds = {}
  for (const t of SEED_TABLES) {
    if (!tables.some(x => x.relname === t)) continue
    const cols = columns.filter(col => col.attrelid === tables.find(x => x.relname === t).oid && !col.attgenerated).map(col => col.attname)
    const [{ data }] = await q(`SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]') AS data FROM ${qn(t)} x`)
    seeds[t] = { cols, data }
  }
  await c.end()

  const by = (rows, key, oid) => rows.filter(r => r[key] === oid)
  const lit = s => `'${String(s).replace(/'/g, "''")}'`

  // ---------- pieces for one table ----------
  function tableParts(t) {
    const cols = by(columns, 'attrelid', t.oid)
    const colLines = cols.map(col => {
      let s = `    ${ident(col.attname)} ${col.type}`
      if (col.attgenerated === 's') s += ` GENERATED ALWAYS AS (${col.def}) STORED`
      else if (col.def != null) s += ` DEFAULT ${col.def}`
      if (col.attnotnull) s += ' NOT NULL'
      return s
    })
    const create = `CREATE TABLE IF NOT EXISTS ${qn(t.relname)} (\n${colLines.join(',\n')}\n);`
    const cons = by(constraints, 'conrelid', t.oid)
    const own = cons.filter(k => k.contype !== 'f').map(k => `ALTER TABLE ${qn(t.relname)} ADD CONSTRAINT ${ident(k.conname)} ${k.def};`)
    const fks = cons.filter(k => k.contype === 'f').map(k => `ALTER TABLE ${qn(t.relname)} ADD CONSTRAINT ${ident(k.conname)} ${k.def};`)
    const idx = by(indexes, 'indrelid', t.oid).map(i => `${i.def};`)
    const rls = [
      ...(t.relrowsecurity ? [`ALTER TABLE ${qn(t.relname)} ENABLE ROW LEVEL SECURITY;`] : []),
      ...(t.relforcerowsecurity ? [`ALTER TABLE ${qn(t.relname)} FORCE ROW LEVEL SECURITY;`] : []),
    ]
    const CMD = { r: 'SELECT', a: 'INSERT', w: 'UPDATE', d: 'DELETE', '*': 'ALL' }
    const pols = by(policies, 'polrelid', t.oid).map(p =>
      `CREATE POLICY ${ident(p.polname)} ON ${qn(t.relname)} AS ${p.polpermissive ? 'PERMISSIVE' : 'RESTRICTIVE'} FOR ${CMD[p.polcmd]}` +
      ` TO ${p.roles.map(grantee).join(', ')}` +
      (p.qual ? `\n    USING (${p.qual})` : '') + (p.chk ? `\n    WITH CHECK (${p.chk})` : '') + ';')
    const trgs = by(triggers, 'tgrelid', t.oid).map(x => `${x.def};`)
    const grants = parseAcl(t.acl).map(g => `GRANT ${g.privs.join(', ')} ON ${qn(t.relname)} TO ${grantee(g.grantee)};`)
    const comments = [
      ...(t.comment ? [`COMMENT ON TABLE ${qn(t.relname)} IS ${lit(t.comment)};`] : []),
      ...cols.filter(col => col.comment).map(col => `COMMENT ON COLUMN ${qn(t.relname)}.${ident(col.attname)} IS ${lit(col.comment)};`),
    ]
    const realtime = pub.has(t.relname) ? [`ALTER PUBLICATION supabase_realtime ADD TABLE ${qn(t.relname)};`] : []
    return { create, own, fks, idx, rls, pols, trgs, grants, comments, realtime }
  }

  // Functions start with execute for PUBLIC; take it away when the saved grants don't include PUBLIC
  const fnRevoke = f => (parseAcl(f.acl).some(g => g.grantee === 'PUBLIC') || f.acl == null ? null
    : `REVOKE ALL ON FUNCTION ${qn(f.proname)}(${f.args}) FROM PUBLIC;`)

  const fnText = f => [
    `${f.def.trim()};`,
    ...(fnRevoke(f) ? [fnRevoke(f)] : []),
    ...parseAcl(f.acl).map(g => `GRANT EXECUTE ON FUNCTION ${qn(f.proname)}(${f.args}) TO ${grantee(g.grantee)};`),
    ...(f.comment ? [`COMMENT ON FUNCTION ${qn(f.proname)}(${f.args}) IS ${lit(f.comment)};`] : []),
  ].join('\n')
  const viewText = v => [
    `CREATE OR REPLACE VIEW ${qn(v.relname)}${v.reloptions?.length ? ` WITH (${v.reloptions.join(', ')})` : ''} AS\n${v.def.trim().replace(/;$/, '')};`,
    ...parseAcl(v.acl).map(g => `GRANT ${g.privs.join(', ')} ON ${qn(v.relname)} TO ${grantee(g.grantee)};`),
  ].join('\n')

  const seqText = s => [
    `CREATE SEQUENCE IF NOT EXISTS ${qn(s.relname)} START WITH ${s.seqstart} INCREMENT BY ${s.seqincrement} MINVALUE ${s.seqmin} MAXVALUE ${s.seqmax} CACHE ${s.seqcache}${s.seqcycle ? ' CYCLE' : ''};`,
    ...parseAcl(s.acl).map(g => `GRANT ${g.privs.join(', ')} ON SEQUENCE ${qn(s.relname)} TO ${grantee(g.grantee)};`),
  ].join('\n')

  const seedText = () => Object.entries(seeds).map(([t, { cols, data }]) =>
    `INSERT INTO ${qn(t)} (${cols.map(ident).join(', ')})\nSELECT ${cols.map(ident).join(', ')} FROM jsonb_populate_recordset(NULL::${qn(t)}, ${lit(JSON.stringify(data))}::jsonb)\nON CONFLICT DO NOTHING;`
  ).join('\n\n')

  const schemaGrants = [
    `CREATE SCHEMA IF NOT EXISTS ${Q};`,
    ...parseAcl(ns.acl).map(g => `GRANT ${g.privs.join(', ')} ON SCHEMA ${Q} TO ${grantee(g.grantee)};`),
    ...defaultAcl.flatMap(d => {
      const obj = { r: 'TABLES', S: 'SEQUENCES', f: 'FUNCTIONS', T: 'TYPES' }[d.kind]
      return parseAcl(d.acl).map(g => `ALTER DEFAULT PRIVILEGES FOR ROLE ${ident(d.role)} IN SCHEMA ${Q} GRANT ${g.privs.join(', ')} ON ${obj} TO ${grantee(g.grantee)};`)
    }),
  ]

  // ---------- write files ----------
  const stamp = `-- Generated by scripts/db/generate-schema.cjs from the dev database. Do not edit by hand:\n-- change the database with a numbered migration, then run the script again.\n`
  for (const dir of ['tables', 'functions', 'views']) {
    fs.rmSync(path.join(OUT_SCHEMA, dir), { recursive: true, force: true })
    fs.mkdirSync(path.join(OUT_SCHEMA, dir), { recursive: true })
  }

  const parts = new Map(tables.map(t => [t.relname, tableParts(t)]))
  for (const t of tables) {
    const p = parts.get(t.relname)
    const sec = (title, rows) => (rows.length ? `\n-- ${title}\n${rows.join('\n')}\n` : '')
    const body = `-- Table ${Q}.${t.relname}\n${stamp}-- Needs the schema, sequences and functions in place first (see parent_migration.sql).\n\n` +
      `${p.create}\n` + sec('Keys and checks', p.own) + sec('Links to other tables', p.fks) + sec('Indexes', p.idx) +
      sec('Row level security', [...p.rls, ...p.pols]) + sec('Triggers', p.trgs) + sec('Grants', p.grants) +
      sec('Realtime', p.realtime) + sec('Comments', p.comments)
    fs.writeFileSync(path.join(OUT_SCHEMA, 'tables', `${t.relname}.sql`), body)
  }
  const fnGroups = new Map()
  for (const f of functions) fnGroups.set(f.proname, [...(fnGroups.get(f.proname) || []), f])
  for (const [name, list] of fnGroups) {
    fs.writeFileSync(path.join(OUT_SCHEMA, 'functions', `${name}.sql`),
      `-- Function ${Q}.${name}\n${stamp}\n${list.map(fnText).join('\n\n')}\n`)
  }
  for (const v of views) fs.writeFileSync(path.join(OUT_SCHEMA, 'views', `${v.relname}.sql`), `-- View ${Q}.${v.relname}\n${stamp}\n${viewText(v)}\n`)
  fs.writeFileSync(path.join(OUT_SCHEMA, 'sequences.sql'), `-- Sequences in ${Q}\n${stamp}\n${sequences.map(seqText).join('\n')}\n`)
  fs.writeFileSync(path.join(OUT_SCHEMA, 'seed.sql'), `-- Starting rows for lookup tables (${SEED_TABLES.join(', ')})\n${stamp}\n${seedText()}\n`)

  // ---------- the central file, in a safe order for an empty database ----------
  const all = [...parts.values()]
  const section = (n, title, body) => `\n-- ==============================================================================\n-- ${n}. ${title}\n-- ==============================================================================\n${body}\n`
  const central =
    `-- ==============================================================================\n-- parent_migration.sql\n-- The complete ${Q} database structure, in one file, for a new database.\n${stamp}` +
    `-- Tables: ${tables.length} · functions: ${functions.length} · views: ${views.length} · sequences: ${sequences.length}\n` +
    `-- The same objects one per file: supabase/migrations/schema/. Change history: the numbered files.\n` +
    `-- ==============================================================================\n\n` +
    `SET check_function_bodies = false;\nSET client_min_messages = warning;\n\nBEGIN;\n` +
    section(1, 'Extensions and schema', ['CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', 'CREATE EXTENSION IF NOT EXISTS "pgcrypto";', ...schemaGrants].join('\n')) +
    section(2, 'Sequences', sequences.map(seqText).join('\n')) +
    section(3, 'Tables (columns and defaults)', all.map(p => p.create).join('\n\n')) +
    section(4, 'Functions', functions.map(fnText).join('\n\n')) +
    section(5, 'Views', views.map(viewText).join('\n\n')) +
    section(6, 'Keys and checks', all.flatMap(p => p.own).join('\n')) +
    section(7, 'Links between tables', all.flatMap(p => p.fks).join('\n')) +
    section(8, 'Indexes', all.flatMap(p => p.idx).join('\n')) +
    section(9, 'Triggers', all.flatMap(p => p.trgs).join('\n')) +
    section(10, 'Row level security', all.flatMap(p => [...p.rls, ...p.pols]).join('\n')) +
    section(11, 'Table grants', all.flatMap(p => p.grants).join('\n')) +
    section(12, 'Realtime', all.flatMap(p => p.realtime).join('\n')) +
    section(13, 'Comments', all.flatMap(p => p.comments).join('\n')) +
    section(14, 'Starting rows for lookup tables', seedText()) +
    `\nCOMMIT;\n\nNOTIFY pgrst, 'reload schema';\n`
  fs.writeFileSync(path.join(OUT, 'parent_migration.sql'), central)

  console.log(`Wrote ${tables.length} tables, ${fnGroups.size} function files (${functions.length} functions), ${views.length} views, ${sequences.length} sequences, parent_migration.sql`)
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
