'use client'

// Dashboard → Off-target leads: every lead staff marked as unrelated or not a fit.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Target } from 'lucide-react'
import { EmptyState, InfoTip, StageBadge } from '@/components/ui'
import { OFF_TARGET_NOTICED, OFF_TARGET_REASONS, OffTargetButton, offTargetNoticed } from '@/components/OffTarget'
import { formatDate } from '@/lib/format'

export type OffTargetRow = {
  business_id: string
  business_name: string
  business_type: string | null
  area: string | null
  opportunity_id: string
  stage: string
  reason: string | null
  noticed: string | null
  note: string | null
  marked_at: string
  marked_by_name: string | null
}

export function OffTargetLeads({ rows }: { rows: OffTargetRow[] }) {
  const [reason, setReason] = useState('all')
  const [noticed, setNoticed] = useState('all')
  const list = useMemo(
    () => rows.filter(r => (reason === 'all' || r.reason === reason) && (noticed === 'all' || r.noticed === noticed)),
    [rows, reason, noticed]
  )
  const byReason = (key: string) => rows.filter(r => r.reason === key).length

  if (!rows.length) {
    return <EmptyState icon={<Target size={36} />} title="No off-target leads" text="Mark a lead off-target from Lead Management, the chat or campaign replies." />
  }

  return (
    <div className="space-y-4">
      {/* Reason totals: click to filter */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {OFF_TARGET_REASONS.map(r => (
          <button
            key={r.key}
            type="button"
            onClick={() => setReason(reason === r.key ? 'all' : r.key)}
            className={`card !p-3 text-left transition-colors ${reason === r.key ? '!border-rose-300' : 'hover:border-slate-300'}`}
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">{r.icon}{r.label}</span>
            <span className="mt-1 block text-2xl font-extrabold text-slate-900">{byReason(r.key)}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select className="input !w-auto !py-1.5 text-xs" value={reason} onChange={e => setReason(e.target.value)} aria-label="Reason">
          <option value="all">All reasons</option>
          {OFF_TARGET_REASONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <select className="input !w-auto !py-1.5 text-xs" value={noticed} onChange={e => setNoticed(e.target.value)} aria-label="Noticed at">
          <option value="all">Noticed anywhere</option>
          {OFF_TARGET_NOTICED.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <span className="ml-auto text-xs text-slate-500">{list.length} of {rows.length}</span>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Business</th>
              <th>Reason</th>
              <th>Noticed at</th>
              <th>Stage</th>
              <th>Marked</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map(r => {
              const why = OFF_TARGET_REASONS.find(x => x.key === r.reason)
              return (
                <tr key={r.business_id}>
                  <td>
                    <Link href={`/dashboard/${r.opportunity_id}`} className="font-semibold hover:text-primary">{r.business_name}</Link>
                    <div className="text-xs text-slate-500">{[r.business_type, r.area].filter(Boolean).join(' · ') || '-'}</div>
                  </td>
                  <td className="text-sm">
                    <span className="inline-flex items-center gap-1.5 font-medium text-rose-700">{why?.icon}{why?.label ?? 'Off-target'}</span>
                    {r.note && <span className="ml-1.5"><InfoTip text={r.note} /></span>}
                  </td>
                  <td className="text-sm text-slate-600">{offTargetNoticed(r.noticed)}</td>
                  <td><StageBadge stage={r.stage} /></td>
                  <td className="whitespace-nowrap text-xs text-slate-500">
                    {formatDate(r.marked_at)}
                    {r.marked_by_name && <div>{r.marked_by_name}</div>}
                  </td>
                  <td className="text-right">
                    <OffTargetButton businessIds={[r.business_id]} marked />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
