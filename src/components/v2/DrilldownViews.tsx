'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronRight,
  Hotel,
  Utensils,
  Beer,
  Building2,
  Calendar,
  User,
  Clock,
  MessageCircle,
  Inbox,
  AlertCircle
} from 'lucide-react'
import { DRILLDOWN_TYPES, DRILLDOWN_PLATFORMS, toTypeSlug, toPlatformSlug, type LeadCategory, type DrilldownPlatform } from '@/lib/config'
import { formatDate, formatDateTime, formatWaiting } from '@/lib/format'
import { assignConsultant } from '@/app/dashboard/actions'
import { EmptyState, ErrorNote, Pagination, PlatformIcon, Spinner, useAction } from '@/components/ui'

const TYPE_ICONS: Record<LeadCategory, React.ComponentType<{ size?: number; className?: string }>> = {
  Hotel: Hotel,
  'Restaurant or cafe': Utensils,
  Pub: Beer,
  'Property management': Building2,
}

// ------------------------------------------------------------------------------
// 1. Status Type Boxes (Status > Type step)
// ------------------------------------------------------------------------------
export function StatusTypeBoxes({
  statusKey,
  statusLabel,
  counts,
}: {
  statusKey: string
  statusLabel: string
  counts: { business_type: string; count: number }[]
}) {
  const countMap = new Map(counts.map(c => [c.business_type, Number(c.count)]))
  const total = counts.reduce((acc, c) => acc + Number(c.count), 0)

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="!mb-1">{statusLabel}</h1>
            <p className="text-sm text-slate-500">
              Select a business type to view businesses in this pipeline status.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {total} total in {statusLabel}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {DRILLDOWN_TYPES.map(cat => {
          const Icon = TYPE_ICONS[cat.key]
          const count = countMap.get(cat.key) ?? 0
          return (
            <Link
              key={cat.key}
              href={`/dashboard/status/${statusKey}/${cat.slug}`}
              className="card card-link group relative flex flex-col justify-between !p-5 transition-all hover:border-primary hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <Icon size={24} />
                </div>
                <ChevronRight size={18} className="text-slate-400 transition-colors group-hover:text-primary" />
              </div>
              <div className="mt-6">
                <div className="text-3xl font-extrabold tracking-tight text-slate-900">{count}</div>
                <div className="mt-1 text-sm font-bold text-slate-800 transition-colors group-hover:text-primary">
                  {cat.label}
                </div>
                <div className="text-xs text-slate-400">{cat.desc}</div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------------------
// 2. Reply Platform Boxes (Needs reply: Status > Type > Platform step)
// ------------------------------------------------------------------------------
export function ReplyPlatformBoxes({
  typeLabel,
  typeSlug,
  counts,
}: {
  typeLabel: string
  typeSlug: string
  counts: { platform: string; count: number }[]
}) {
  const countMap = new Map(counts.map(c => [c.platform, Number(c.count)]))
  const total = counts.reduce((acc, c) => acc + Number(c.count), 0)

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="!mb-1">{typeLabel}</h1>
            <p className="text-sm text-slate-500">
              Select an outreach platform to view awaiting replies.
            </p>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            {total} awaiting reply
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {DRILLDOWN_PLATFORMS.map(platform => {
          const count = countMap.get(platform) ?? 0
          return (
            <Link
              key={platform}
              href={`/dashboard/status/needs-reply/${typeSlug}/${toPlatformSlug(platform)}`}
              className="card card-link group relative flex flex-col justify-between !p-5 transition-all hover:border-primary hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <PlatformIcon platform={platform} size={24} />
                </div>
                <ChevronRight size={18} className="text-slate-400 transition-colors group-hover:text-primary" />
              </div>
              <div className="mt-6">
                <div className="text-3xl font-extrabold tracking-tight text-slate-900">{count}</div>
                <div className="mt-1 text-sm font-bold text-slate-800 transition-colors group-hover:text-primary">
                  {platform}
                </div>
                <div className="text-xs text-slate-400">
                  {count === 1 ? '1 lead waiting' : `${count} leads waiting`}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------------------
// 3. Status Lead Rows and Table
// ------------------------------------------------------------------------------
export type StatusListRow = {
  opportunity_id: string
  business_id: string
  business_name: string
  business_type: string
  thread_id?: string | null
  platform?: string | null
  latest_message?: string | null
  last_inbound_at?: string | null
  consultation_at?: string | null
  consultant_id?: string | null
  consultant_name?: string | null
  last_contact_at?: string | null
  platforms_tried?: string[] | null
  total_count: number | string
}

export function StatusLeadList({
  statusKey,
  statusLabel,
  typeLabel,
  typeSlug,
  platform,
  rows,
  total,
  page,
  pageSize = 25,
  consultants = [],
}: {
  statusKey: string
  statusLabel: string
  typeLabel: string
  typeSlug: string
  platform?: string | null
  rows: StatusListRow[]
  total: number
  page: number
  pageSize?: number
  consultants?: { id: string; full_name: string }[]
}) {
  const isNeedsReply = statusKey === 'needs-reply'
  const isInterested = statusKey === 'interested'
  const isConsultation = statusKey === 'consultation'
  const isNeedsConsultant = statusKey === 'needs-consultant'
  const isWentCold = statusKey === 'went-cold'
  const isNoResponse = statusKey === 'no-response'

  const basePath = isNeedsReply && platform
    ? `/dashboard/status/needs-reply/${typeSlug}/${toPlatformSlug(platform)}`
    : `/dashboard/status/${statusKey}/${typeSlug}`

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="!mb-1">
              {typeLabel} {platform ? `on ${platform}` : ''}
            </h1>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Status: {statusLabel}
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {total} {total === 1 ? 'lead' : 'leads'} total
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Inbox size={36} />}
          title={`No ${typeLabel} leads in ${statusLabel}`}
          text="When leads enter this stage, they will appear here."
        />
      ) : (
        <div className="space-y-3">
          {rows.map(r => {
            if (isNeedsReply) {
              const targetUrl = r.thread_id
                ? `/dashboard/${r.opportunity_id}/thread/${r.thread_id}`
                : `/dashboard/${r.opportunity_id}`

              return (
                <Link
                  key={r.thread_id || r.opportunity_id}
                  href={targetUrl}
                  className="card card-link group flex flex-col justify-between gap-2 !p-4 transition-all hover:border-primary hover:shadow-sm sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 group-hover:text-primary transition-colors">
                        {r.business_name}
                      </span>
                      {r.platform && (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          · <PlatformIcon platform={r.platform} size={14} /> {r.platform}
                        </span>
                      )}
                    </div>
                    {r.latest_message ? (
                      <p className="mt-1 truncate text-sm text-slate-600">
                        &quot;{r.latest_message}&quot;
                      </p>
                    ) : (
                      <p className="mt-1 text-xs italic text-slate-400">No message text recorded</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {r.last_inbound_at && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                        <Clock size={12} /> {formatWaiting(r.last_inbound_at)}
                      </span>
                    )}
                    <span className="btn btn-primary btn-sm shrink-0">Open chat</span>
                  </div>
                </Link>
              )
            }

            if (isInterested) {
              return (
                <Link
                  key={r.opportunity_id}
                  href={`/dashboard/${r.opportunity_id}`}
                  className="card card-link group flex flex-col justify-between gap-2 !p-4 transition-all hover:border-primary hover:shadow-sm sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-slate-900 group-hover:text-primary transition-colors">
                      {r.business_name}
                    </span>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      {r.platform && (
                        <span className="inline-flex items-center gap-1">
                          Replied on <PlatformIcon platform={r.platform} size={13} /> {r.platform}
                        </span>
                      )}
                      {r.last_inbound_at && (
                        <span>
                          {r.platform ? '· ' : ''}{formatDate(r.last_inbound_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="btn btn-secondary btn-sm">View lead</span>
                  </div>
                </Link>
              )
            }

            if (isConsultation) {
              return (
                <Link
                  key={r.opportunity_id}
                  href={`/dashboard/${r.opportunity_id}`}
                  className="card card-link group flex flex-col justify-between gap-2 !p-4 transition-all hover:border-primary hover:shadow-sm sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-slate-900 group-hover:text-primary transition-colors">
                      {r.business_name}
                    </span>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={13} />
                        {r.consultation_at ? formatDateTime(r.consultation_at) : 'Date not set'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        · <User size={13} />
                        Consultant: {r.consultant_name || 'Unassigned'}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="btn btn-secondary btn-sm">View lead</span>
                  </div>
                </Link>
              )
            }

            if (isNeedsConsultant) {
              return (
                <div
                  key={r.opportunity_id}
                  className="card flex flex-col justify-between gap-3 !p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/${r.opportunity_id}`}
                      className="font-semibold text-slate-900 hover:text-primary transition-colors"
                    >
                      {r.business_name}
                    </Link>
                    <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <Calendar size={13} />
                      Booking date: {r.consultation_at ? formatDateTime(r.consultation_at) : 'No time set'}
                    </div>
                  </div>
                  <AssignConsultantControl opportunityId={r.opportunity_id} consultants={consultants} />
                </div>
              )
            }

            if (isWentCold) {
              return (
                <Link
                  key={r.opportunity_id}
                  href={`/dashboard/${r.opportunity_id}`}
                  className="card card-link group flex flex-col justify-between gap-2 !p-4 transition-all hover:border-primary hover:shadow-sm sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-slate-900 group-hover:text-primary transition-colors">
                      {r.business_name}
                    </span>
                    <div className="mt-1 text-xs text-slate-500">
                      Last contact: {r.last_contact_at ? formatDate(r.last_contact_at) : 'No outreach recorded'}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="btn btn-secondary btn-sm">View lead</span>
                  </div>
                </Link>
              )
            }

            if (isNoResponse) {
              const platforms = r.platforms_tried || []
              return (
                <Link
                  key={r.opportunity_id}
                  href={`/dashboard/${r.opportunity_id}`}
                  className="card card-link group flex flex-col justify-between gap-2 !p-4 transition-all hover:border-primary hover:shadow-sm sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-slate-900 group-hover:text-primary transition-colors">
                      {r.business_name}
                    </span>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span>Platforms tried:</span>
                      {platforms.length > 0 ? (
                        platforms.map(p => (
                          <span
                            key={p}
                            className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700"
                          >
                            <PlatformIcon platform={p} size={12} /> {p}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="btn btn-secondary btn-sm">View lead</span>
                  </div>
                </Link>
              )
            }

            // Fallback row
            return (
              <Link
                key={r.opportunity_id}
                href={`/dashboard/${r.opportunity_id}`}
                className="card card-link group flex items-center justify-between !p-4"
              >
                <span className="font-semibold text-slate-900 group-hover:text-primary">
                  {r.business_name}
                </span>
                <span className="btn btn-secondary btn-sm">View lead</span>
              </Link>
            )
          })}
        </div>
      )}

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        basePath={basePath}
        params={{}}
      />
    </div>
  )
}

function AssignConsultantControl({
  opportunityId,
  consultants,
}: {
  opportunityId: string
  consultants: { id: string; full_name: string }[]
}) {
  const { run, pending, error } = useAction()
  const [selected, setSelected] = useState('')

  return (
    <div className="flex flex-wrap items-center gap-2" onClick={e => e.stopPropagation()}>
      <select
        className="input !h-9 !py-1 !text-xs !w-44"
        value={selected}
        onChange={e => setSelected(e.target.value)}
        disabled={pending}
        aria-label="Choose consultant"
      >
        <option value="">Choose consultant...</option>
        {consultants.map(c => (
          <option key={c.id} value={c.id}>
            {c.full_name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-primary btn-sm !h-9"
        disabled={!selected || pending}
        onClick={() => run(() => assignConsultant(opportunityId, selected), undefined, { success: 'Consultant assigned.' })}
      >
        {pending && <Spinner size={12} />} Assign
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
