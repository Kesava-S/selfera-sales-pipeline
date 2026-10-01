'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronRight } from 'lucide-react'
import { CONFIG, STATUS_PAGES } from '@/lib/config'
import { dueLabel, stepLabel } from '@/lib/format'
import { ErrorNote, PlatformIcon } from '@/components/ui'

type DueItem = { thread_id: string; opportunity_id: string; business_name: string; business_type: string; platform: string; step: number; status: string; next_due_on: string | null; draft_status: string | null }
type ServiceRow = { service_name: string; businesses_count: number; replies_count: number; active_count: number; won_count: number }

const TABS = [
  { key: 'new', label: 'New outreach' },
  { key: 'followups', label: 'Follow-ups' },
  { key: 'replies', label: 'Replies' },
] as const

export function DashboardHome({
  name, role, counts, services, due, loadError,
}: {
  name: string; role: string; counts: Record<string, number>; services: ServiceRow[]
  due: { new: DueItem[]; followups: DueItem[]; replies: DueItem[] }; loadError: string | null
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>(due.replies.length ? 'replies' : due.new.length ? 'new' : 'followups')
  const items = due[tab]
  const isAdmin = role === 'admin'
  const boxes = Object.entries(STATUS_PAGES).filter(([, s]) => !s.adminOnly || isAdmin)

  return (
    <div className="space-y-8">
      <div>
        <h1>Hello {name}</h1>
        <p className="text-sm text-slate-500">Here&apos;s what needs you today.</p>
      </div>
      <ErrorNote error={loadError} />

      {Number(counts.needs_review ?? 0) > 0 && role !== 'consultant' && (
        <Link href="/dashboard/leads?tab=review" className="card card-link flex items-center justify-between !border-amber-200 !bg-amber-50 !py-3">
          <span className="text-sm font-semibold text-amber-900">{counts.needs_review} lead(s) waiting for review. Approve them to start outreach.</span>
          <ChevronRight size={18} className="text-amber-700" />
        </Link>
      )}

      {/* Due today */}
      <section>
        <h2 className="mb-3">Due today</h2>
        <div className="card !p-0">
          <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-2">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                {t.label}
                <span className={`rounded-full px-2 text-xs ${due[t.key].length ? 'bg-primary-bg text-primary' : 'bg-slate-100 text-slate-500'}`}>{due[t.key].length}</span>
              </button>
            ))}
          </div>
          {items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <CheckCircle2 size={18} className="text-emerald-500" /> Nothing here. All caught up.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map(i => {
                const d = dueLabel(i.next_due_on)
                return (
                  <li key={i.thread_id} className="flex items-center gap-3 px-4 py-3">
                    <PlatformIcon platform={i.platform} size={18} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{i.business_name}</div>
                      <div className="text-xs text-slate-500">
                        {i.business_type} · {tab === 'replies' ? `Replied on ${i.platform}` : `${stepLabel(i.step, i.status)} on ${i.platform}`}
                        {tab !== 'replies' && d.tone === 'overdue' && <span className="ml-1 font-semibold text-red-600">· {d.text}</span>}
                        {i.draft_status === 'needs_data' && <span className="ml-1 font-semibold text-amber-700">· draft needs details</span>}
                      </div>
                    </div>
                    <Link href={`/dashboard/${i.opportunity_id}/thread/${i.thread_id}`} className="btn btn-primary btn-sm">Open</Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Status boxes */}
      <section>
        <h2 className="mb-3">Status</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
          {boxes.map(([key, s]) => {
            const n = Number(counts[s.countKey] ?? 0)
            return (
              <Link key={key} href={`/dashboard/status/${key}`} className={`card card-link !p-4 ${s.adminOnly && n > 0 ? '!border-amber-300' : ''}`}>
                <div className="text-2xl font-bold">{n}</div>
                <div className="text-xs font-semibold text-slate-500">{s.label}</div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Services */}
      <section>
        <h2 className="mb-3">Services</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {CONFIG.SERVICES.map(name => {
            const s = services.find(x => x.service_name === name)
            return (
              <Link key={name} href={`/dashboard/service/${encodeURIComponent(name)}`} className="card card-link flex flex-col gap-3 !p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{name}</h3>
                  <ChevronRight size={16} className="text-slate-400" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat n={s?.replies_count} label="Replies" tone="text-emerald-700" />
                  <Stat n={s?.active_count} label="Active" />
                  <Stat n={s?.won_count} label="Won" tone="text-primary" />
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function Stat({ n, label, tone = '' }: { n?: number; label: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 py-2">
      <div className={`text-lg font-bold ${tone}`}>{Number(n ?? 0)}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  )
}
