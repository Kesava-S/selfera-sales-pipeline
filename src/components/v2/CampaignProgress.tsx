'use client'

// Live progress for a launched campaign. While the campaign is sending, each
// poll asks /api/campaigns/process to send the next batch, so the queue keeps
// moving even before the background cron picks it up.

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, RotateCw, Send } from 'lucide-react'
import { retryFailedCampaignSends } from '@/app/dashboard/actions'
import { Spinner, useAction } from '@/components/ui'
import type { CampaignChannel, CampaignProgress as Progress } from '@/lib/campaignQueue'

export function useCampaignProgress(channel: CampaignChannel, campaignId: string | null) {
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [run, setRun] = useState(0)

  useEffect(() => {
    if (!campaignId) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const tick = async () => {
      try {
        const res = await fetch('/api/campaigns/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel, campaignId }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || 'Could not check campaign progress.')
        if (stopped) return
        setError(null)
        setProgress(json.progress)
        // Keep going straight away while there is work; check back later for retries
        if (json.progress?.status === 'sending') {
          const busy = json.progress.queued - json.progress.retrying > 0 || json.progress.sending > 0
          timer = setTimeout(tick, busy ? 800 : 15_000)
        }
      } catch (e) {
        if (stopped) return
        setError(e instanceof Error ? e.message : 'Could not check campaign progress.')
        timer = setTimeout(tick, 5_000)
      }
    }
    tick()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [channel, campaignId, run])

  return { progress, error, refresh: () => setRun(n => n + 1) }
}

export function CampaignProgress({
  channel,
  campaignId,
  compact = false,
  onStatusChange,
}: {
  channel: CampaignChannel
  campaignId: string
  compact?: boolean
  onStatusChange?: (status: string, progress: Progress) => void
}) {
  const { progress: p, error, refresh } = useCampaignProgress(channel, campaignId)
  const retry = useAction()
  const [showFailures, setShowFailures] = useState(false)

  // Tell the parent when the campaign moves between sending and sent
  const lastStatus = useRef<string | null>(null)
  useEffect(() => {
    if (p?.status && p.status !== lastStatus.current) {
      lastStatus.current = p.status
      onStatusChange?.(p.status, p)
    }
  }, [p, onStatusChange])

  if (!p) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {error ? <><AlertTriangle size={13} className="text-amber-600" /> {error}</> : <><Spinner size={13} /> Checking progress…</>}
      </div>
    )
  }

  const done = p.sent + p.failed
  const pct = p.total ? Math.round((done / p.total) * 100) : 0
  const sending = p.status === 'sending'
  const unit = channel === 'email' ? 'email' : 'message'

  // Campaigns sent before the send queue existed have no per-recipient rows
  if (!sending && p.total === 0 && p.skipped === 0) {
    return compact ? null : (
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        This campaign was sent before delivery tracking was added, so there is no per-recipient report.
      </p>
    )
  }

  if (compact) {
    return (
      <div className="w-full max-w-xs space-y-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-[11px] font-medium text-slate-500">
          {p.sent} of {p.total} sent{p.failed ? ` · ${p.failed} failed` : ''}{p.retrying ? ` · ${p.retrying} retrying` : ''}
          {channel === 'whatsapp' && p.delivered > 0 ? ` · ${p.delivered} delivered · ${p.read} read` : ''}
        </div>
      </div>
    )
  }

  const failures = p.failures.filter(f => f.error !== 'Opted out')
  const optedOut = p.failures.filter(f => f.error === 'Opted out')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${sending ? 'bg-sky-100 text-sky-700' : p.failed ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {sending ? <Send size={18} /> : p.failed ? <AlertTriangle size={18} /> : <CheckCircle2 size={20} className="motion-check-pop" />}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900">
            {sending ? `Sending… ${done} of ${p.total}` : p.failed ? `Sent with ${p.failed} failed` : 'Campaign sent'}
          </h3>
          <p className="text-xs text-slate-500">
            {sending
              ? 'You can close this window. Sending carries on in the background.'
              : `${p.sent} ${unit}${p.sent === 1 ? '' : 's'} delivered to the provider.`}
          </p>
        </div>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${p.failed && !sending ? 'bg-amber-500' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Stat label="Sent" value={p.sent} tone="text-emerald-700" />
        <Stat label="Retrying" value={p.retrying} tone="text-sky-700" />
        <Stat label="Failed" value={p.failed} tone="text-rose-700" />
        <Stat label="Opted out" value={p.skipped} tone="text-slate-600" />
      </div>

      {/* WhatsApp tells us when each message arrives and is opened */}
      {channel === 'whatsapp' && p.sent + p.failed > 0 && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Stat label={`Delivered (${pctOf(p.delivered, p.sent + p.failed)})`} value={p.delivered} tone="text-slate-800" />
          <Stat label={`Read (${pctOf(p.read, p.sent + p.failed)})`} value={p.read} tone="text-sky-700" />
        </div>
      )}

      {p.simulated > 0 && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          {p.simulated} recorded as simulated: {channel === 'email' ? 'SMTP' : 'WhatsApp'} is not set up in this environment, so nothing was actually sent.
        </p>
      )}

      {(failures.length > 0 || optedOut.length > 0) && (
        <div className="rounded-lg border border-slate-200">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700"
            onClick={() => setShowFailures(v => !v)}
            aria-expanded={showFailures}
          >
            Not sent ({failures.length + optedOut.length})
            <ChevronDown size={14} className={`transition-transform duration-200 ${showFailures ? 'rotate-180' : ''}`} />
          </button>
          {showFailures && (
            <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto border-t border-slate-100 text-xs motion-error-in">
              {[...failures, ...optedOut].map((f, i) => (
                <li key={i} className="flex items-start justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">{f.name || f.to}</span>
                    {f.name && <span className="block truncate text-slate-500">{f.to}</span>}
                  </span>
                  <span className={`shrink-0 text-right ${f.error === 'Opted out' ? 'text-slate-500' : 'text-rose-600'}`}>{f.error}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!sending && p.failed > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={retry.pending}
            onClick={() => retry.run(() => retryFailedCampaignSends(channel, campaignId), () => refresh(), { success: `Retrying ${p.failed} failed ${unit}${p.failed === 1 ? '' : 's'}.` })}
          >
            {retry.pending ? <Spinner size={14} /> : <RotateCw size={14} />} Retry {p.failed} failed
          </button>
        </div>
      )}
    </div>
  )
}

const pctOf = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : '0%')

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className={`text-base font-bold ${tone}`}>{value}</div>
      <div className="text-slate-500">{label}</div>
    </div>
  )
}
