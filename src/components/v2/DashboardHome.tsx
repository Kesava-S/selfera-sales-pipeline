'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronRight, ArrowUpRight } from 'lucide-react'
import { STATUS_PAGES } from '@/lib/config'
import { dueLabel, stepLabel } from '@/lib/format'
import { ErrorNote, PlatformIcon } from '@/components/ui'

type DueItem = {
  thread_id: string
  opportunity_id: string
  business_name: string
  business_type: string
  platform: string
  step: number
  status: string
  next_due_on: string | null
  draft_status: string | null
}

const TABS = [
  { key: 'new', label: 'New outreach' },
  { key: 'followups', label: 'Follow-ups' },
  { key: 'replies', label: 'Replies' },
] as const

export function DashboardHome({
  name,
  role,
  counts,
  due,
  loadError,
}: {
  name: string
  role: string
  counts: Record<string, number>
  due: { new: DueItem[]; followups: DueItem[]; replies: DueItem[] }
  loadError: string | null
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>(
    due.replies.length ? 'replies' : due.new.length ? 'new' : 'followups'
  )
  const items = due[tab]
  const isAdmin = role === 'admin'
  const boxes = Object.entries(STATUS_PAGES).filter(([, s]) => !s.adminOnly || isAdmin)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Hello {name}</h1>
        <p className="text-sm text-slate-500">Here&apos;s what needs your attention today.</p>
      </div>
      <ErrorNote error={loadError} />

      {Number(counts.needs_review ?? 0) > 0 && role !== 'consultant' && (
        <Link
          href="/dashboard/leads?tab=review"
          className="card card-link flex items-center justify-between !border-amber-200 !bg-amber-50 !py-3 hover:!border-amber-300"
        >
          <span className="text-sm font-semibold text-amber-900">
            {counts.needs_review} lead(s) waiting for review. Approve them to start outreach.
          </span>
          <ChevronRight size={18} className="text-amber-700" />
        </Link>
      )}

      {/* Status boxes */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Pipeline Status</h2>
          <span className="text-xs text-slate-500">Click any status to explore by business category</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {boxes.map(([key, s]) => {
            const n = Number(counts[s.countKey] ?? 0)
            return (
              <Link
                key={key}
                href={`/dashboard/status/${key}`}
                className={`card card-link group relative flex flex-col justify-between !p-4 transition-all hover:border-primary hover:shadow-sm ${
                  s.adminOnly && n > 0 ? '!border-amber-300 bg-amber-50/30' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 group-hover:text-primary transition-colors">
                    {s.label}
                  </span>
                  <ArrowUpRight size={14} className="text-slate-300 group-hover:text-primary transition-colors" />
                </div>
                <div className="mt-4 flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold tracking-tight text-slate-900">{n}</span>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Due today */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-900">Due today</h2>
        <div className="card !p-0">
          <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-2">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                  tab === t.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    due[t.key].length ? 'bg-primary-bg text-primary' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {due[t.key].length}
                </span>
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
                  <li key={i.thread_id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors">
                    <PlatformIcon platform={i.platform} size={18} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-slate-900">{i.business_name}</div>
                      <div className="text-xs text-slate-500">
                        {i.business_type} · {tab === 'replies' ? `Replied on ${i.platform}` : `${stepLabel(i.step, i.status)} on ${i.platform}`}
                        {tab !== 'replies' && d.tone === 'overdue' && (
                          <span className="ml-1 font-semibold text-red-600">· {d.text}</span>
                        )}
                        {i.draft_status === 'needs_data' && (
                          <span className="ml-1 font-semibold text-amber-700">· draft needs details</span>
                        )}
                      </div>
                    </div>
                    <Link href={`/dashboard/${i.opportunity_id}/thread/${i.thread_id}`} className="btn btn-primary btn-sm">
                      Open
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
