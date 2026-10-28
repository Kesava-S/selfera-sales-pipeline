'use client'

// Replies to email and WhatsApp campaigns: a list inside each campaign's
// report, a link with the number of new replies, and the full replies page.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowUpRight, Inbox, Mail, MessageCircle, Undo2, X } from 'lucide-react'
import { countNewCampaignReplies, dismissCampaignReply, listCampaignReplies, openCampaignReply } from '@/app/dashboard/campaigns/replies/actions'
import type { CampaignReply } from '@/lib/campaignReplies'
import { EmptyState, ErrorNote, Spinner, useAction } from '@/components/ui'
import { formatDateTime } from '@/lib/format'

const STATUS: Record<CampaignReply['status'], { label: string; cls: string }> = {
  new: { label: 'New', cls: '!border-sky-200 !bg-sky-50 !text-sky-700' },
  in_leads: { label: 'In Lead Management', cls: '!border-emerald-200 !bg-emerald-50 !text-emerald-700' },
  dismissed: { label: 'Dismissed', cls: '' },
}

export function ReplyItem({ r, showCampaign = true, onChange }: { r: CampaignReply; showCampaign?: boolean; onChange?: () => void }) {
  const router = useRouter()
  const { run, pending, isPending, error } = useAction()
  const [expanded, setExpanded] = useState(false)
  const campaign = r.email_campaigns?.name || r.whatsapp_campaigns?.name
  const long = r.body.length > 220

  const open = () => run(() => openCampaignReply(r.id), data => {
    onChange?.()
    if (data) router.push(`/dashboard/${data.opportunity_id}/thread/${data.thread_id}`)
  }, { success: 'Reply moved to Lead Management.', key: 'open' })

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {r.channel === 'email' ? <Mail size={14} className="text-slate-400" /> : <MessageCircle size={14} className="text-emerald-600" />}
            <span className="font-semibold text-slate-900">{r.businesses?.business_name || r.from_address}</span>
            {r.businesses && <span className="text-xs text-slate-500">{r.from_address}</span>}
            <span className={`badge ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
            {!campaign && <span className="badge !border-amber-200 !bg-amber-50 !text-amber-700">Unmatched</span>}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatDateTime(r.received_at)}
            {showCampaign && campaign && <> · Replied to <b className="font-semibold text-slate-600">{campaign}</b></>}
            {!campaign && ' · Not from a recent campaign'}
            {!r.business_id && ' · Not in Lead Management'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {r.status === 'in_leads' && r.opportunity_id && r.thread_id ? (
            <Link href={`/dashboard/${r.opportunity_id}/thread/${r.thread_id}`} className="btn btn-secondary btn-sm"><ArrowUpRight size={14} /> Open chat</Link>
          ) : (
            <>
              {r.status === 'dismissed' ? (
                <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => dismissCampaignReply(r.id, true), onChange, { key: 'undo' })}>
                  {isPending('undo') ? <Spinner size={14} /> : <Undo2 size={14} />} Undo
                </button>
              ) : (
                <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => dismissCampaignReply(r.id), onChange, { success: 'Reply dismissed.', key: 'dismiss' })}>
                  {isPending('dismiss') ? <Spinner size={14} /> : <X size={14} />} Dismiss
                </button>
              )}
              <button className="btn btn-primary btn-sm" disabled={pending || !r.business_id} title={r.business_id ? '' : 'Add this sender as a business first'} onClick={open}>
                {isPending('open') ? <Spinner size={14} /> : <ArrowUpRight size={14} />} Open in Lead Management
              </button>
            </>
          )}
        </div>
      </div>
      {r.subject && <p className="text-sm font-semibold text-slate-700">{r.subject}</p>}
      <p className={`whitespace-pre-wrap break-words rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ${expanded || !long ? '' : 'line-clamp-3'}`}>{r.body}</p>
      {long && <button className="text-xs font-semibold text-primary hover:underline" onClick={() => setExpanded(v => !v)}>{expanded ? 'Show less' : 'Show all'}</button>}
      <ErrorNote error={error} />
    </li>
  )
}

// Inside a campaign's report
export function CampaignRepliesList({ channel, campaignId, count }: { channel: 'email' | 'whatsapp'; campaignId: string; count: number }) {
  const [replies, setReplies] = useState<CampaignReply[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [show, setShow] = useState(false)

  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!show) return
    let live = true
    listCampaignReplies(channel, campaignId)
      .catch(() => ({ ok: false as const, error: 'Could not load replies.' }))
      .then(res => {
        if (!live) return
        if (res.ok) { setReplies(res.data || []); setError(null) } else setError(res.error)
      })
    return () => { live = false }
  }, [show, channel, campaignId, count, reload])
  const load = () => setReload(n => n + 1)

  if (!count) return null
  return (
    <div className="rounded-lg border border-slate-200">
      <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700" onClick={() => setShow(v => !v)} aria-expanded={show}>
        Replies ({count})
        <span className="text-primary">{show ? 'Hide' : 'Show'}</span>
      </button>
      {show && (
        <div className="border-t border-slate-100">
          {error && <p className="px-3 py-2 text-xs text-red-600">{error}</p>}
          {!replies && !error && <p className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500"><Spinner size={12} /> Loading…</p>}
          {replies && <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">{replies.map(r => <ReplyItem key={r.id} r={r} showCampaign={false} onChange={load} />)}</ul>}
        </div>
      )}
    </div>
  )
}

// In the campaign page header
export function RepliesLink({ channel }: { channel: 'email' | 'whatsapp' }) {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => { countNewCampaignReplies(channel).then(setCount).catch(() => setCount(null)) }, [channel])
  return (
    <Link href={channel === 'email' ? '/dashboard/campaigns/replies' : '/dashboard/whatsapp-campaigns/replies'} className="btn btn-secondary btn-sm">
      <Inbox size={14} /> Replies
      {!!count && <span className="rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">{count}</span>}
    </Link>
  )
}

// The full replies page
export function CampaignRepliesView({ channel, replies, filters, counts }: {
  channel: 'email' | 'whatsapp'
  replies: CampaignReply[]
  filters: { status: string; unmatched: boolean }
  counts: { new: number; in_leads: number; dismissed: number; unmatched: number }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const go = (patch: Partial<typeof filters>) => {
    const next = { ...filters, ...patch }
    const p = new URLSearchParams()
    if (next.status !== 'new') p.set('status', next.status)
    if (next.unmatched) p.set('unmatched', '1')
    router.replace(p.toString() ? `${pathname}?${p}` : pathname, { scroll: false })
  }
  const tabs = [
    { key: 'new', label: 'New', count: counts.new },
    { key: 'in_leads', label: 'In Lead Management', count: counts.in_leads },
    { key: 'dismissed', label: 'Dismissed', count: counts.dismissed },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="!mb-0 text-2xl font-bold tracking-tight text-slate-900">{channel === 'email' ? 'Email' : 'WhatsApp'} campaign replies</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {channel === 'email'
            ? 'Replies to email campaigns, plus replies from senders we don\'t know.'
            : 'Replies to WhatsApp campaigns, plus messages from numbers we don\'t know.'}{' '}
          Open one in Lead Management to follow it up one-to-one.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => go({ status: t.key })}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold ${filters.status === t.key ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {t.label} <span className={`rounded-full px-2 py-0.5 text-xs ${filters.status === t.key ? 'bg-primary-bg' : 'bg-slate-100'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 px-1 text-sm text-slate-600">
          <input type="checkbox" checked={filters.unmatched} onChange={e => go({ unmatched: e.target.checked })} />
          Only unmatched{counts.unmatched ? ` (${counts.unmatched} new)` : ''}
        </label>
      </div>

      {replies.length === 0 ? (
        <EmptyState icon={<Inbox size={40} />} title={filters.status === 'new' ? 'No new replies' : 'Nothing here'} text={filters.status === 'new' ? 'Replies to your campaigns show up here as they arrive.' : undefined} />
      ) : (
        <ul className="card divide-y divide-slate-100 !p-0">
          {replies.map(r => <ReplyItem key={r.id} r={r} onChange={() => router.refresh()} />)}
        </ul>
      )}
    </div>
  )
}
