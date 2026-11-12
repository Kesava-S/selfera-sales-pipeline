'use client'

// Off-target leads: businesses reached during outreach or campaigns that turn out
// to be unrelated to us, or not a fit at follow-up / consultation (migration 67).
// Marked and undone by staff only; the stage never changes.

import { useState } from 'react'
import { Ban, Building2, PhoneOff, Target, Undo2, UserX } from 'lucide-react'
import { clearOffTarget, markOffTarget } from '@/app/dashboard/actions'
import { InfoTip, Modal, Spinner, toast, useAction } from '@/components/ui'
import { formatDate } from '@/lib/format'

export const OFF_TARGET_REASONS: { key: string; label: string; hint: string; icon: React.ReactNode }[] = [
  { key: 'unrelated', label: 'Unrelated business', hint: 'Not in our field at all', icon: <Ban size={13} /> },
  { key: 'wrong_type', label: 'Not our business type', hint: 'Outside the business types we serve', icon: <Building2 size={13} /> },
  { key: 'wrong_contact', label: 'Wrong contact', hint: 'Number or email belongs to someone else', icon: <PhoneOff size={13} /> },
  { key: 'not_a_fit', label: 'Not a fit', hint: 'Looked right, found wrong at follow-up or consultation', icon: <UserX size={13} /> },
]

export const OFF_TARGET_NOTICED: { key: string; label: string }[] = [
  { key: 'outreach', label: 'Outreach' },
  { key: 'campaign', label: 'Campaign' },
  { key: 'follow_up', label: 'Follow-up' },
  { key: 'consultation', label: 'Consultation' },
]

export const offTargetReason = (key?: string | null) => OFF_TARGET_REASONS.find(r => r.key === key)?.label ?? 'Off-target'
export const offTargetNoticed = (key?: string | null) => OFF_TARGET_NOTICED.find(r => r.key === key)?.label ?? '-'

export type OffTargetFields = {
  off_target_at?: string | null
  off_target_reason?: string | null
  off_target_noticed?: string | null
  off_target_note?: string | null
}

// Text-only label with an icon; the details sit in the "i" tip
export function OffTargetLabel({ c, by, className = '' }: { c: OffTargetFields; by?: string | null; className?: string }) {
  if (!c.off_target_at) return null
  const tip = [
    offTargetReason(c.off_target_reason),
    `Noticed at ${offTargetNoticed(c.off_target_noticed).toLowerCase()}`,
    `${by ? `${by}, ` : ''}${formatDate(c.off_target_at)}`,
    c.off_target_note,
  ].filter(Boolean).join(' · ')
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 ${className}`}>
      <Target size={12} /> Off-target
      <InfoTip text={tip} />
    </span>
  )
}

// Mark (with a reason) or Undo. Works for one lead or a selection.
export function OffTargetButton({ businessIds, marked, defaultNoticed = 'outreach', names, size = 'sm', onDone }: {
  businessIds: string[]
  marked: boolean
  defaultNoticed?: string
  names?: string
  size?: 'sm' | 'md'
  onDone?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [noticed, setNoticed] = useState(defaultNoticed)
  const [note, setNote] = useState('')
  const { run, pending, isPending } = useAction()
  const btn = `btn btn-secondary ${size === 'sm' ? 'btn-sm' : ''}`
  const n = businessIds.length

  if (marked) {
    return (
      <button className={btn} disabled={pending} onClick={() => run(() => clearOffTarget(businessIds), () => {
        toast.success(n > 1 ? `${n} leads are back in the pipeline.` : 'Back in the pipeline.')
        onDone?.()
      }, { key: 'undo' })}>
        {isPending('undo') ? <Spinner size={14} /> : <Undo2 size={14} />} Undo off-target
      </button>
    )
  }

  const save = () => run(() => markOffTarget(businessIds, reason, noticed, note), () => {
    toast.success(n > 1 ? `${n} leads marked off-target.` : 'Marked off-target.')
    setOpen(false)
    setReason('')
    setNote('')
    onDone?.()
  }, { key: 'mark' })

  return (
    <>
      <button className={`${btn} !text-rose-700`} disabled={pending} onClick={() => { setNoticed(defaultNoticed); setOpen(true) }}>
        <Target size={14} /> Off-target
      </button>
      <Modal open={open} onClose={() => setOpen(false)} locked={pending} title={n > 1 ? `Mark ${n} leads off-target` : 'Mark off-target'}>
        <div className="space-y-4">
          {names && <p className="text-sm font-medium text-slate-800">{names}</p>}

          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              Reason <InfoTip align="left" text="The stage doesn't change. Off-target leads leave the pipeline counts, Due today and new campaigns. Undo any time." />
            </legend>
            {OFF_TARGET_REASONS.map(r => (
              <label key={r.key} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${reason === r.key ? 'border-rose-300 text-rose-800' : 'border-slate-200 text-slate-700 hover:border-slate-300'}`}>
                <input type="radio" name="off-target-reason" value={r.key} checked={reason === r.key} onChange={() => setReason(r.key)} />
                <span className="inline-flex items-center gap-1.5 font-medium">{r.icon}{r.label}</span>
                <span className="ml-auto text-xs text-slate-400">{r.hint}</span>
              </label>
            ))}
          </fieldset>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Noticed at</span>
            <select className="input" value={noticed} onChange={e => setNoticed(e.target.value)}>
              {OFF_TARGET_NOTICED.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Note (optional)</span>
            <input className="input" maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. It's a dental clinic" />
          </label>

          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost" disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={pending || !reason} onClick={save}>
              {isPending('mark') ? <Spinner /> : <Target size={15} />} Mark off-target
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
