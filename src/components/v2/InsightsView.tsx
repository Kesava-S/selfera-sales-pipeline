'use client'

import { useRouter } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
import { CONFIG } from '@/lib/config'
import { PlatformIcon, ErrorNote, EmptyState } from '@/components/ui'

export type InsightsData = {
  totals: { reached: number; replied: number; interested: number; consultation: number; won: number }
  platforms: { platform: string; sent: number; replied: number }[]
  steps: { step: string; sent: number; replied: number }[]
  wins: { total: number; conversion: Record<string, number>; through: Record<string, number> }
  templates: { name: string; platform: string; step: string; sent: number; replied: number }[]
}

const MIN_SENDS = 10
// Call and visit outcomes are written as notes, so there is no reply to count
const NOT_TRACKED = ['Phone', 'Walk-in']
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)

export function InsightsView({ data, loadError, params, isAdmin, staff }: {
  data: InsightsData | null
  loadError: string | null
  params: { from: string; to: string; service: string; user: string }
  isAdmin: boolean
  staff: { id: string; full_name: string; role: string }[]
}) {
  const router = useRouter()
  const go = (patch: Partial<typeof params>) => {
    const next = { ...params, ...patch }
    const q = new URLSearchParams()
    Object.entries(next).forEach(([k, v]) => { if (v) q.set(k, v) })
    router.push(`/dashboard/insights?${q.toString()}`)
  }

  const t = data?.totals
  const empty = !t || t.reached === 0

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Insights</h1>

      {/* Filters */}
      <div className="card flex flex-wrap items-center gap-2 !p-3">
        <input type="date" className="input !w-auto" value={params.from} max={params.to} onChange={e => e.target.value && go({ from: e.target.value })} aria-label="From" />
        <span className="text-sm text-muted">to</span>
        <input type="date" className="input !w-auto" value={params.to} min={params.from} onChange={e => e.target.value && go({ to: e.target.value })} aria-label="To" />
        <select className="input !w-auto" value={params.service} onChange={e => go({ service: e.target.value })} aria-label="Service">
          <option value="">All services</option>
          {CONFIG.SERVICES.map(s => <option key={s}>{s}</option>)}
        </select>
        {isAdmin && (
          <select className="input !w-auto" value={params.user} onChange={e => go({ user: e.target.value })} aria-label="Person">
            <option value="">Everyone</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.full_name || 'No name'}</option>)}
          </select>
        )}
      </div>

      <ErrorNote error={loadError} />

      {!loadError && empty && (
        <EmptyState icon={<BarChart3 size={28} />} title="No outreach in these dates" text="Numbers appear once messages are sent." />
      )}

      {!loadError && data && t && !empty && (
        <>
          {/* Five numbers */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Reached" value={t.reached} />
            <Stat label="Reply rate" value={`${pct(t.replied, t.reached)}%`} sub={`${t.replied} replied`} />
            <Stat label="Interested" value={t.interested} />
            <Stat label="Consultations" value={t.consultation} />
            <Stat label="Won" value={t.won} />
          </div>

          {/* Funnel */}
          <div className="card space-y-2">
            <h2 className="font-semibold">Funnel</h2>
            {[
              ['Reached', t.reached], ['Replied', t.replied], ['Interested', t.interested],
              ['Consultation', t.consultation], ['Won', t.won],
            ].map(([label, n]) => (
              <Bar key={label} label={label as string} value={n as number} max={t.reached} right={`${n}${label === 'Reached' ? '' : ` · ${pct(n as number, t.reached)}%`}`} />
            ))}
          </div>

          {/* Where replies come from */}
          <div className="grid gap-5 md:grid-cols-2">
            <div className="card space-y-2">
              <h2 className="font-semibold">Reply rate by platform</h2>
              {data.platforms.length === 0 && <p className="text-sm text-muted">Nothing sent yet.</p>}
              {data.platforms.map(p => {
                const off = NOT_TRACKED.includes(p.platform)
                return (
                  <Bar key={p.platform} label={<span className="flex items-center gap-1.5"><PlatformIcon platform={p.platform} size={14} />{p.platform}</span>}
                    value={off ? 0 : pct(p.replied, p.sent)} max={100} right={off ? `Not tracked · ${p.sent}` : `${pct(p.replied, p.sent)}% · ${p.replied}/${p.sent}`} />
                )
              })}
            </div>
            <div className="card space-y-2">
              <h2 className="font-semibold">Which message got the reply</h2>
              {data.steps.length === 0 && <p className="text-sm text-muted">Nothing sent yet.</p>}
              {data.steps.map(s => (
                <Bar key={s.step} label={s.step} value={pct(s.replied, s.sent)} max={100} right={`${pct(s.replied, s.sent)}% · ${s.replied}/${s.sent}`} />
              ))}
            </div>
          </div>

          {/* Wins */}
          <div className="card">
            <h2 className="font-semibold">Wins <span className="text-muted font-normal">({data.wins.total})</span></h2>
            {data.wins.total === 0 ? (
              <p className="mt-2 text-sm text-muted">No wins in these dates.</p>
            ) : (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Breakdown title="Compared with the pitch" order={['As pitched', 'Expanded', 'Narrowed', 'Switched', 'Not recorded']} values={data.wins.conversion} />
                <Breakdown title="Converted through" values={data.wins.through} />
              </div>
            )}
          </div>

          {/* Templates */}
          {data.templates.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-semibold">Templates</h2>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Template</th><th className="!text-right">Sent</th><th className="!text-right">Reply rate</th></tr></thead>
                  <tbody>
                    {data.templates.map((tp, i) => (
                      <tr key={i}>
                        <td><span className="flex items-center gap-1.5"><PlatformIcon platform={tp.platform} size={14} className="shrink-0" />{tp.name}</span></td>
                        <td className="text-right">{tp.sent}</td>
                        <td className="text-right">
                          {NOT_TRACKED.includes(tp.platform) ? <span className="text-xs text-muted">Not tracked</span>
                            : tp.sent < MIN_SENDS ? <span className="text-xs text-muted">Too few to judge</span> : `${pct(tp.replied, tp.sent)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="card !p-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  )
}

function Bar({ label, value, max, right }: { label: React.ReactNode; value: number; max: number; right: string }) {
  const w = max > 0 ? Math.max(value > 0 ? 2 : 0, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="w-24 shrink-0 truncate sm:w-32">{label}</div>
      <div className="h-2.5 flex-1 rounded-full bg-slate-100">
        <div className="h-2.5 rounded-full bg-primary" style={{ width: `${w}%` }} />
      </div>
      <div className="w-28 shrink-0 text-right text-muted tabular-nums">{right}</div>
    </div>
  )
}

function Breakdown({ title, values, order }: { title: string; values: Record<string, number>; order?: string[] }) {
  const keys = order ? order.filter(k => values[k]) : Object.keys(values).sort((a, b) => values[b] - values[a])
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted">{title}</div>
      {keys.map(k => (
        <div key={k} className="flex justify-between border-b border-slate-100 py-1.5 text-sm last:border-0">
          <span>{k}</span><span className="font-medium">{values[k]}</span>
        </div>
      ))}
    </div>
  )
}
