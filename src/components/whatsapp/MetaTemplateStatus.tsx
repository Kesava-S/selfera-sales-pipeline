'use client'

// Meta review status of the WhatsApp template a chat would send outside the
// 24-hour window (chat composer). Text-only label with an icon and manual refresh.

import { useState } from 'react'
import { CheckCircle2, Clock, XCircle, RefreshCw } from 'lucide-react'
import { InfoTip } from '@/components/ui'
import { syncMetaTemplates } from '@/app/dashboard/templates/metaActions'

const LOOK: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  APPROVED: { label: 'Approved', cls: 'text-emerald-700', icon: <CheckCircle2 size={13} /> },
  PENDING: { label: 'In review', cls: 'text-amber-700', icon: <Clock size={13} /> },
  IN_APPEAL: { label: 'In appeal', cls: 'text-amber-700', icon: <Clock size={13} /> },
  REJECTED: { label: 'Rejected', cls: 'text-red-600', icon: <XCircle size={13} /> },
  PAUSED: { label: 'Paused', cls: 'text-red-600', icon: <XCircle size={13} /> },
  DISABLED: { label: 'Disabled', cls: 'text-red-600', icon: <XCircle size={13} /> },
  DELETED: { label: 'Deleted in Meta', cls: 'text-red-600', icon: <XCircle size={13} /> },
}
const NOT_OURS = { label: 'Not in this product', cls: 'text-red-600', icon: <XCircle size={13} /> }

// For the template picker's <option> text (no icons possible there)
// status: undefined/null = the outreach template has no Meta template (the default is used); 'NONE' = linked but not ours
export function metaOptionLabel(status: string | null | undefined) {
  if (!status) return 'default Meta template'
  if (status === 'NONE') return 'Meta: not in this product'
  if (status === 'APPROVED') return '✓ Meta approved'
  return `Meta: ${(LOOK[status]?.label ?? status).toLowerCase()}`
}

export function MetaTemplateStatus({ name, status, outsideWindow, fromTemplate, onRefresh }: {
  name: string
  status: string | null
  outsideWindow: boolean
  fromTemplate: boolean
  onRefresh?: () => void | Promise<void>
}) {
  const [syncing, setSyncing] = useState(false)
  const look = status ? LOOK[status] ?? { label: status, cls: 'text-slate-500', icon: null } : NOT_OURS
  const approved = status === 'APPROVED'

  const handleSync = async () => {
    setSyncing(true)
    try {
      await syncMetaTemplates()
      if (onRefresh) {
        await onRefresh()
      } else if (typeof window !== 'undefined') {
        window.location.reload()
      }
    } catch (err) {
      console.error('Meta sync error:', err)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-slate-500">Meta template</span>
        <span className="font-mono text-slate-800 font-medium">{name}</span>
        {!fromTemplate && <span className="text-slate-400">(default)</span>}
        <span className={`inline-flex items-center gap-1 font-semibold ${look.cls}`}>{look.icon}{look.label}</span>
        <InfoTip
          align="right"
          text={outsideWindow
            ? 'They haven’t messaged in 24 hours, so WhatsApp only delivers this approved template.'
            : 'They messaged in the last 24 hours, so a normal message is sent. The template is only needed after 24 hours.'}
        />
      </div>

      <button
        type="button"
        onClick={handleSync}
        disabled={syncing}
        title="Check latest review status directly from Meta"
        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50 transition-colors"
      >
        <RefreshCw size={11} className={syncing ? 'animate-spin text-primary' : ''} />
        {syncing ? 'Checking Meta…' : 'Refresh status'}
      </button>

      {outsideWindow && !approved && (
        <span className="w-full font-medium text-red-600">Can’t send until it’s approved. Pick another template, or click &ldquo;Refresh status&rdquo; once approved in Meta.</span>
      )}
    </div>
  )
}
