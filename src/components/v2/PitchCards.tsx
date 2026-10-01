'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Star } from 'lucide-react'
import { dueLabel } from '@/lib/format'
import { EmptyState, Pagination, PlatformStatus, StageBadge } from '@/components/ui'
import type { PitchRow } from '@/components/v2/LeadsManagement'

export const FILTER_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'needs-reply', label: 'Needs reply' },
  { key: 'Interested', label: 'Interested' },
  { key: 'Went cold', label: 'Went cold' },
  { key: 'No response', label: 'No response' },
]

export function PitchCards({
  rows, total, page, pageSize, basePath, params, showChips = true, emptyText,
}: {
  rows: PitchRow[]; total: number; page: number; pageSize: number; basePath: string
  params: Record<string, string | undefined>; showChips?: boolean; emptyText?: string
}) {
  const router = useRouter()
  const go = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams()
    Object.entries({ ...params, ...patch, page: undefined }).forEach(([k, v]) => v && v !== 'all' && q.set(k, v))
    router.push(`${basePath}${q.toString() ? `?${q}` : ''}`)
  }
  const filter = params.filter || 'all'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {showChips && FILTER_CHIPS.map(c => (
          <button key={c.key} className={`chip ${filter === c.key ? 'active' : ''}`} onClick={() => go({ filter: c.key })}>{c.label}</button>
        ))}
        <form className="relative ml-auto w-full sm:w-72" onSubmit={e => { e.preventDefault(); go({ q: (new FormData(e.currentTarget).get('q') as string) || undefined }) }}>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={params.q} placeholder="Search businesses" className="input !pl-9" />
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Search size={32} />} title="No businesses here" text={emptyText ?? 'Nothing matches right now.'} />
      ) : (
        <>
          <p className="text-sm text-slate-500">{total.toLocaleString('en-GB')} business{total === 1 ? '' : 'es'}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map(r => {
              const due = dueLabel(r.next_due_on)
              return (
                <Link key={r.opportunity_id} href={`/dashboard/${r.opportunity_id}`} className="card card-link flex flex-col gap-3 !p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-bold" title={r.business_name}>{r.business_name}</h3>
                      <div className="flex items-center gap-1.5 text-sm text-slate-500">
                        <span className="truncate">{[r.business_type, r.area].filter(Boolean).join(' · ')}</span>
                        {r.google_rating ? <span className="flex shrink-0 items-center gap-0.5"><Star size={12} className="fill-amber-400 text-amber-400" />{r.google_rating}</span> : null}
                      </div>
                    </div>
                    <StageBadge stage={r.stage} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.threads.length ? r.threads.map(t => <PlatformStatus key={t.platform} platform={t.platform} status={t.status} step={t.step} />)
                      : <span className="text-xs text-slate-400">{r.stage === 'Needs review' ? 'Waiting for review' : 'No outreach yet'}</span>}
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                    {r.needs_reply ? <span className="font-semibold text-emerald-700">Needs your reply</span>
                      : <span className={due.tone === 'overdue' ? 'font-semibold text-red-600' : due.tone === 'today' ? 'font-semibold text-amber-700' : 'text-slate-500'}>{due.text}</span>}
                    <span className="text-slate-400">{r.services_pitched.join(', ')}</span>
                  </div>
                </Link>
              )
            })}
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} basePath={basePath} params={params} />
        </>
      )}
    </div>
  )
}
