/**
 * DEMO MODE stand-in for the Supabase client (local testing only).
 * Answers the queries the dashboard makes using the in-memory café data.
 * Switched on by NEXT_PUBLIC_DEMO_MODE=true while running `npm run dev`.
 */
import { getDemoStore, DEMO_USER, type DemoStore } from './demoData'

type Row = Record<string, any>
type Result = { data: any; error: any; count?: number | null }

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production'
}

const SERVICES = ['Website', 'Micro Automation', 'End-to-End Automation', 'Custom Dashboard', 'Cold Outreach']

const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)))
const newId = () =>
  (globalThis.crypto && 'randomUUID' in globalThis.crypto)
    ? globalThis.crypto.randomUUID()
    : `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`
const today = () => new Date().toISOString().slice(0, 10)

function getPath(row: Row, path: string): any {
  return path.split('.').reduce((v: any, k) => (v == null ? undefined : v[k]), row)
}

function addWorkingDays(from: Date, days: number): string {
  const d = new Date(from)
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    const day = d.getDay()
    if (day !== 0 && day !== 6) added += 1
  }
  return d.toISOString().slice(0, 10)
}

// ---------- joins (shape the rows the way the pages expect) ----------

function withAliases(b: Row | undefined) {
  if (!b) return b
  return { ...b, phone_number: b.phone, email_address: b.email, instagram_handle: b.instagram }
}

function hydrate(store: DemoStore, table: string, row: Row): Row {
  if (table === 'opportunities') {
    return {
      ...row,
      businesses: withAliases(store.businesses.find(b => b.id === row.business_id)),
      threads: store.threads
        .filter(t => t.opportunity_id === row.id)
        .map(t => ({ ...t, drafts: store.drafts.filter(d => d.thread_id === t.id) })),
      stage_changes: store.stage_changes.filter(s => s.opportunity_id === row.id),
    }
  }
  if (table === 'threads') {
    const o = store.opportunities.find(x => x.id === row.opportunity_id)
    return {
      ...row,
      messages: store.messages.filter(m => m.thread_id === row.id),
      drafts: store.drafts.filter(d => d.thread_id === row.id),
      opportunities: o ? { ...o, businesses: withAliases(store.businesses.find(b => b.id === o.business_id)) } : null,
    }
  }
  if (table === 'businesses') {
    return withAliases({ ...row, opportunities: store.opportunities.filter(o => o.business_id === row.id) }) as Row
  }
  return row
}

// ---------- filters ----------

function likeToRegex(pattern: string, insensitive: boolean) {
  const esc = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')
  return new RegExp(`^${esc}$`, insensitive ? 'i' : '')
}

function cmp(op: string, actual: any, expected: any): boolean {
  switch (op) {
    case 'eq': return String(actual) === String(expected)
    case 'neq': return String(actual) !== String(expected)
    case 'gt': return actual != null && actual > expected
    case 'gte': return actual != null && actual >= expected
    case 'lt': return actual != null && actual < expected
    case 'lte': return actual != null && actual <= expected
    case 'like': return actual != null && likeToRegex(String(expected), false).test(String(actual))
    case 'ilike': return actual != null && likeToRegex(String(expected), true).test(String(actual))
    case 'is': return expected === null || expected === 'null' ? actual == null : actual === expected
    case 'in': return (Array.isArray(expected) ? expected : String(expected).replace(/[()"]/g, '').split(',')).map(String).includes(String(actual))
    case 'cs': case 'contains':
      return Array.isArray(actual) && (Array.isArray(expected) ? expected : [expected]).every(v => actual.includes(v))
    default: return true
  }
}

function parseOr(expr: string): (row: Row) => boolean {
  const parts = expr.split(',').map(p => p.trim()).filter(Boolean)
  const checks = parts.map(p => {
    const m = p.match(/^([\w.]+?)\.(not\.)?(eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs)\.(.*)$/)
    if (!m) return () => true
    const [, col, not, op, val] = m
    return (row: Row) => {
      const r = cmp(op, getPath(row, col), val)
      return not ? !r : r
    }
  })
  return row => checks.some(c => c(row))
}

// ---------- query builder ----------

class DemoQuery implements PromiseLike<Result> {
  private filters: ((row: Row) => boolean)[] = []
  private orders: { col: string; asc: boolean }[] = []
  private from?: number
  private to?: number
  private limitN?: number
  private mode: 'many' | 'single' | 'maybe' = 'many'
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private payload: any
  private wantCount = false
  private headOnly = false

  constructor(private store: DemoStore, private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.count) this.wantCount = true
    if (opts?.head) this.headOnly = true
    return this
  }
  insert(p: any) { this.op = 'insert'; this.payload = p; return this }
  upsert(p: any) { this.op = 'upsert'; this.payload = p; return this }
  update(p: any) { this.op = 'update'; this.payload = p; return this }
  delete() { this.op = 'delete'; return this }

  private add(op: string, col: string, val: any) {
    this.filters.push(row => cmp(op, getPath(row, col), val))
    return this
  }
  eq(c: string, v: any) { return this.add('eq', c, v) }
  neq(c: string, v: any) { return this.add('neq', c, v) }
  gt(c: string, v: any) { return this.add('gt', c, v) }
  gte(c: string, v: any) { return this.add('gte', c, v) }
  lt(c: string, v: any) { return this.add('lt', c, v) }
  lte(c: string, v: any) { return this.add('lte', c, v) }
  like(c: string, v: any) { return this.add('like', c, v) }
  ilike(c: string, v: any) { return this.add('ilike', c, v) }
  is(c: string, v: any) { return this.add('is', c, v) }
  in(c: string, v: any[]) { return this.add('in', c, v) }
  contains(c: string, v: any) { return this.add('contains', c, v) }
  not(c: string, op: string, v: any) { this.filters.push(row => !cmp(op, getPath(row, c), v)); return this }
  or(expr: string) { this.filters.push(parseOr(expr)); return this }
  match(obj: Row) { Object.entries(obj).forEach(([k, v]) => this.add('eq', k, v)); return this }
  filter(c: string, op: string, v: any) { return this.add(op, c, v) }
  order(col: string, opts?: { ascending?: boolean }) { this.orders.push({ col, asc: opts?.ascending !== false }); return this }
  range(a: number, b: number) { this.from = a; this.to = b; return this }
  limit(n: number) { this.limitN = n; return this }
  single() { this.mode = 'single'; return this }
  maybeSingle() { this.mode = 'maybe'; return this }
  abortSignal() { return this }

  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, fail?: ((e: any) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve().then(() => this.run()).then(ok, fail)
  }

  private rows(): Row[] {
    const list = (this.store as any)[this.table]
    if (!Array.isArray(list)) (this.store as any)[this.table] = []
    return (this.store as any)[this.table]
  }

  private finish(data: Row[], count?: number): Result {
    if (this.mode === 'single') {
      if (data.length !== 1) return { data: null, error: { code: 'PGRST116', message: 'Row not found (demo mode)' } }
      return { data: data[0], error: null }
    }
    if (this.mode === 'maybe') return { data: data[0] ?? null, error: null }
    return { data, error: null, count: this.wantCount ? (count ?? data.length) : null }
  }

  private run(): Result {
    const list = this.rows()

    if (this.op === 'insert' || this.op === 'upsert') {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((p: Row) => {
        if (this.op === 'upsert' && p.id) {
          const existing = list.find(r => r.id === p.id)
          if (existing) { Object.assign(existing, p); return existing }
        }
        const row = { id: newId(), created_at: new Date().toISOString(), ...p }
        list.push(row)
        return row
      })
      return this.finish(clone(items))
    }

    if (this.op === 'update') {
      const hit = list.filter(r => this.filters.every(f => f(r)))
      hit.forEach(r => Object.assign(r, this.payload, 'updated_at' in r ? { updated_at: new Date().toISOString() } : {}))
      return this.finish(clone(hit))
    }

    if (this.op === 'delete') {
      const keep = list.filter(r => !this.filters.every(f => f(r)))
      const removed = list.filter(r => this.filters.every(f => f(r)))
      list.splice(0, list.length, ...keep)
      return this.finish(clone(removed))
    }

    // select
    let data = list.map(r => hydrate(this.store, this.table, r)).filter(r => this.filters.every(f => f(r)))
    for (const o of [...this.orders].reverse()) {
      data = [...data].sort((a, b) => {
        const x = getPath(a, o.col), y = getPath(b, o.col)
        if (x == null && y == null) return 0
        if (x == null) return 1
        if (y == null) return -1
        return (x < y ? -1 : x > y ? 1 : 0) * (o.asc ? 1 : -1)
      })
    }
    const total = data.length
    if (this.from !== undefined && this.to !== undefined) data = data.slice(this.from, this.to + 1)
    if (this.limitN !== undefined) data = data.slice(0, this.limitN)
    if (this.headOnly) return { data: null, error: null, count: total }
    return this.finish(clone(data), total)
  }
}

// ---------- database functions (rpc) ----------

function rpc(store: DemoStore, name: string, p: Row = {}): Result {
  const opps = store.opportunities
  const threadsOf = (oppId: string) => store.threads.filter(t => t.opportunity_id === oppId)

  switch (name) {
    case 'v_dashboard_status_counts':
      return {
        data: [{
          needs_reply: store.threads.filter(t => t.status === 'Replied').length,
          interested: opps.filter(o => o.stage === 'Interested').length,
          consultation: opps.filter(o => o.stage === 'Consultation').length,
          went_cold: opps.filter(o => o.stage === 'Went cold').length,
          no_response: opps.filter(o => o.stage === 'No response').length,
          needs_consultant: opps.filter(o => o.stage === 'Consultation' && !o.assigned_consultant_id).length,
          unmatched_bookings: store.consultation_bookings.filter(b => b.match_status === 'unmatched').length,
        }],
        error: null,
      }

    case 'v_service_counts':
      return {
        data: SERVICES.map(s => {
          const list = opps.filter(o => (o.services_pitched || []).includes(s))
          return {
            service_name: s,
            replies_count: list.filter(o => threadsOf(o.id).some(t => t.status === 'Replied')).length,
            active_count: list.filter(o => o.stage === 'Active').length,
            won_count: list.filter(o => o.stage === 'Won').length,
          }
        }),
        error: null,
      }

    case 'v_business_type_counts': {
      const list = opps.filter(o => (o.services_pitched || []).includes(p.p_service))
      const byType: Record<string, Row> = {}
      for (const o of list) {
        const b = store.businesses.find(x => x.id === o.business_id)
        if (!b) continue
        const row = (byType[b.business_type] ||= { business_type: b.business_type, ids: new Set(), replies: new Set(), due: new Set() })
        row.ids.add(b.id)
        const ts = threadsOf(o.id)
        if (ts.some(t => t.status === 'Replied')) row.replies.add(o.id)
        if (ts.some(t => t.next_due_on && t.next_due_on <= today())) row.due.add(o.id)
      }
      return {
        data: Object.values(byType).map(r => ({ business_type: r.business_type, businesses_count: r.ids.size, replies_count: r.replies.size, due_today_count: r.due.size })),
        error: null,
      }
    }

    case 'record_outbound': {
      const t = store.threads.find(x => x.id === p.p_thread_id)
      if (!t) return { data: null, error: { message: 'Thread not found (demo mode)' } }
      const newStep = Math.min((t.step || 0) + 1, 4)
      const days = newStep === 1 ? 3 : newStep === 2 ? 5 : newStep === 3 ? 14 : null
      const now = new Date()
      const draft = store.drafts.find(d => d.thread_id === t.id && ['ready', 'needs_data'].includes(d.status))
      store.messages.push({
        id: newId(), thread_id: t.id, direction: 'outbound', body: p.p_body, subject: p.p_subject ?? null,
        template_id: p.p_template_id ?? null, step_label: draft?.step_label ?? null, send_method: p.p_send_method ?? 'api',
        external_message_id: p.p_external_message_id ?? null, sent_by: p.p_sent_by ?? DEMO_USER.id,
        delivery_status: 'sent', created_at: now.toISOString(),
      })
      t.step = newStep
      t.status = 'Awaiting reply'
      t.next_due_on = days ? addWorkingDays(now, days) : null
      t.last_outbound_at = now.toISOString()
      store.drafts.filter(d => d.thread_id === t.id && ['ready', 'needs_data'].includes(d.status)).forEach(d => { d.status = 'sent' })
      const o = opps.find(x => x.id === t.opportunity_id)
      if (o && o.stage === 'Needs review') o.stage = 'Active'
      return { data: null, error: null }
    }

    case 'set_stage': {
      const o = opps.find(x => x.id === p.p_opportunity_id)
      if (o) {
        store.stage_changes.push({ id: newId(), opportunity_id: o.id, from_stage: o.stage, to_stage: p.p_stage, reason: p.p_reason ?? null, changed_by: DEMO_USER.id, created_at: new Date().toISOString() })
        o.stage = p.p_stage
      }
      return { data: null, error: null }
    }

    default:
      // Other functions do nothing in demo mode
      return { data: null, error: null }
  }
}

// ---------- the client ----------

export function createDemoClient(): any {
  const store = getDemoStore()
  const channel: any = { on: () => channel, subscribe: () => channel, unsubscribe: async () => 'ok' }
  return {
    from: (table: string) => new DemoQuery(store, table),
    schema: () => ({ from: (table: string) => new DemoQuery(store, table) }),
    rpc: (name: string, params?: Row) => {
      const res = rpc(store, name, params)
      const thenable: any = {
        then: (ok: any, fail: any) => Promise.resolve(clone(res)).then(ok, fail),
        single: () => ({ then: (ok: any, fail: any) => Promise.resolve({ ...clone(res), data: Array.isArray(res.data) ? res.data[0] ?? null : res.data }).then(ok, fail) }),
      }
      return thenable
    },
    auth: {
      getUser: async () => ({ data: { user: { ...DEMO_USER } }, error: null }),
      getSession: async () => ({ data: { session: { user: { ...DEMO_USER } } }, error: null }),
      signInWithPassword: async () => ({ data: { user: { ...DEMO_USER }, session: {} }, error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    channel: () => channel,
    removeChannel: async () => 'ok',
    removeAllChannels: async () => [],
  }
}
