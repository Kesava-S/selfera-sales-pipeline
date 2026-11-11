'use client'

// Email check UI: the badge next to an email, and the check of a CSV file's emails
// in the import's check step (before anything is saved).

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, HelpCircle, MailCheck, Trash2, XCircle } from 'lucide-react'
import { checkEmailList } from '@/app/dashboard/emailCheckActions'
import { EMAIL_STATUS_LABEL, type EmailCheck, type EmailStatus } from '@/lib/emailCheck'
import { InfoTip, Spinner } from '@/components/ui'

export type EmailCheckFields = {
  email_status?: EmailStatus | null
  email_reason?: string | null
  email_suggestion?: string | null
  email_role?: boolean | null
}

// Text-only labels (no background)
const STYLE: Record<EmailStatus, { cls: string; icon: React.ReactNode }> = {
  valid: { cls: 'text-emerald-700', icon: <CheckCircle2 size={12} /> },
  risky: { cls: 'text-amber-700', icon: <AlertTriangle size={12} /> },
  unknown: { cls: 'text-slate-500', icon: <HelpCircle size={12} /> },
  invalid: { cls: 'text-red-600', icon: <XCircle size={12} /> },
  disposable: { cls: 'text-red-600', icon: <Trash2 size={12} /> },
}

export function EmailBadge({ c }: { c: EmailCheckFields }) {
  if (!c.email_status) return <span className="text-[11px] text-slate-400">Not checked</span>
  const s = STYLE[c.email_status]
  const title = [c.email_reason, c.email_suggestion && `Did you mean ${c.email_suggestion}?`, c.email_role && 'Shared inbox'].filter(Boolean).join(' · ')
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 text-[11px] font-medium" title={title || undefined}>
      <span className={`inline-flex items-center gap-0.5 ${s.cls}`}>{s.icon}{EMAIL_STATUS_LABEL[c.email_status]}</span>
      {c.email_role && <span className="text-slate-500">· Shared inbox</span>}
      {c.email_suggestion && <span className="text-amber-700">· Typo?</span>}
    </span>
  )
}

// "Left out" label for an import row that has no WhatsApp mobile and no working email
export function LeftOutLabel({ reason }: { reason?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600" title={reason}>
      <XCircle size={12} /> Left out{reason ? <span className="font-normal text-slate-500">· {reason}</span> : null}
    </span>
  )
}

// Short reason: "No WhatsApp · Throwaway email"
export function leftOutReason(phoneType: string | null | undefined, hasEmail: boolean, check: EmailCheck | null | undefined) {
  const wa = phoneType === 'landline' ? 'Landline' : phoneType === 'invalid' ? 'Invalid phone' : 'No WhatsApp'
  const email = !hasEmail ? 'no email' : check?.status === 'disposable' ? 'throwaway email' : 'invalid email'
  return `${wa} · ${email}`
}

// A working email: anything not found Invalid or Throwaway (Valid, Risky, Unknown, or not checked)
export const emailWorks = (hasEmail: boolean, syntaxOk: boolean, check: EmailCheck | null | undefined) =>
  hasEmail && (check ? check.status !== 'invalid' && check.status !== 'disposable' : syntaxOk)

// ---------- Checking the emails of a CSV file (import check step) ----------

export type EmailListCheck = {
  results: Record<string, EmailCheck | null>
  running: boolean
  done: number
  total: number
  outOfCredits: boolean
  credits: number | null
  error: string | null
}

// Each email is sent for checking only once per page, even if the check starts twice
// (React runs effects twice in development, or the file is re-mapped): saves free credits.
type Round = Awaited<ReturnType<typeof checkEmailList>>
const asked = new Map<string, Promise<Round>>()
async function checkOnce(round: string[]): Promise<Round> {
  const fresh = round.filter(e => !asked.has(e))
  if (fresh.length) {
    const p = checkEmailList(fresh)
    for (const e of fresh) asked.set(e, p)
  }
  const all = await Promise.all([...new Set(round.map(e => asked.get(e)!))])
  const failed = all.find(r => !r.ok)
  const ok = all.filter(r => r.ok).map(r => r.data!)
  // Forget what wasn't checked, so it can be tried again later
  for (const e of round) if (!ok.some(d => d.results[e])) asked.delete(e)
  if (failed && !ok.length) return failed
  return {
    ok: true,
    data: {
      results: Object.fromEntries(round.map(e => [e, ok.find(d => d.results[e])?.results[e] ?? null])),
      outOfCredits: ok.some(d => d.outOfCredits),
      credits: ok.reduce<number | null>((m, d) => (d.credits === null ? m : m === null ? d.credits : Math.min(m, d.credits)), null),
      error: ok.find(d => d.error)?.error ?? (failed && !failed.ok ? failed.error : null),
    },
  }
}

// Checks every email once, in rounds, as soon as `emails` is set. Results are by lower-case email.
export function useEmailListCheck(emails: string[] | null): EmailListCheck {
  const key = emails ? JSON.stringify([...new Set(emails.map(e => e.trim().toLowerCase()).filter(Boolean))].sort()) : ''
  const fresh = (k: string): EmailListCheck => ({ results: {}, running: !!k, done: 0, total: k ? (JSON.parse(k) as string[]).length : 0, outOfCredits: false, credits: null, error: null })
  const [s, setS] = useState<EmailListCheck>(() => fresh(key))
  // A different file or mapping: start again
  const [forKey, setForKey] = useState(key)
  if (forKey !== key) {
    setForKey(key)
    setS(fresh(key))
  }

  useEffect(() => {
    if (!key) return
    let live = true
    const queue: string[] = JSON.parse(key)
    const results: Record<string, EmailCheck | null> = {}
    ;(async () => {
      let outOfCredits = false
      let error: string | null = null
      let credits: number | null = null
      while (queue.length && live && !outOfCredits && !error) {
        const round = queue.splice(0, 10)
        try {
          const res = await checkOnce(round)
          if (!res.ok) { error = res.error; break }
          const d = res.data!
          outOfCredits = d.outOfCredits
          error = d.error
          credits = d.credits ?? credits
          let got = 0
          for (const e of round) {
            const c = d.results[e] ?? null
            if (c) { results[e] = c; got++ }
            else if (!outOfCredits && !error) queue.push(e) // ran out of time: try again
            else results[e] = null
          }
          if (!got && !outOfCredits && !error) { error = 'The email check is not responding. Try again later.'; break }
        } catch (e) {
          error = e instanceof Error ? e.message : 'Email check failed.'
        }
        if (live) setS(p => ({ ...p, results: { ...results }, done: Object.values(results).filter(Boolean).length, outOfCredits, credits, error }))
      }
      for (const e of queue) results[e] = null
      if (live) setS(p => ({ ...p, results: { ...results }, running: false, outOfCredits, credits, error }))
    })()
    return () => { live = false }
  }, [key])
  return s
}

// The check result for one email of the file, as a badge
export function EmailCheckBadge({ check, running }: { check: EmailCheck | null | undefined; running: boolean }) {
  if (check === undefined && running) return <span className="inline-flex items-center gap-1 text-[10px] text-slate-400"><Spinner size={10} /> Checking</span>
  if (!check) return <EmailBadge c={{}} />
  return <EmailBadge c={{ email_status: check.status, email_reason: check.reason, email_suggestion: check.suggestion, email_role: check.role }} />
}

// Email check section in the import's check step
export function EmailCheckSummary({ c }: { c: EmailListCheck }) {
  if (!c.total) return null
  const all = Object.values(c.results).filter(Boolean) as EmailCheck[]
  const count = (st: EmailStatus) => all.filter(x => x.status === st).length
  const bad = count('invalid') + count('disposable')
  const notChecked = Object.values(c.results).filter(v => v === null).length
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
          {c.running ? <Spinner size={13} /> : <MailCheck size={14} className="text-primary" />}
          {c.running ? `Checking emails ${c.done}/${c.total}` : 'Emails'}
          <InfoTip align="left" text="Checked before import. Invalid and throwaway emails don’t count as a contact." />
        </span>
        <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={12} /> {count('valid')} valid</span>
        <span className="inline-flex items-center gap-1 text-amber-700"><AlertTriangle size={12} /> {count('risky')} risky</span>
        <span className="inline-flex items-center gap-1 text-slate-500"><HelpCircle size={12} /> {count('unknown')} unknown</span>
        <span className={`inline-flex items-center gap-1 ${bad ? 'text-red-600' : 'text-slate-500'}`}><XCircle size={12} /> {bad} invalid</span>
        {notChecked > 0 && (
          <span className="inline-flex items-center gap-1 text-slate-400">
            {notChecked} not checked{c.outOfCredits && <InfoTip text="Today’s free checks are used up." />}
          </span>
        )}
        {c.credits !== null && <span className="ml-auto text-[11px] text-slate-400">{c.credits} checks left today</span>}
      </div>
      {c.running && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${c.total ? Math.round((c.done / c.total) * 100) : 0}%` }} />
        </div>
      )}
      {!c.running && c.error && <p className="mt-1 text-xs text-red-600">{c.error}</p>}
    </div>
  )
}

// "N left out" section in the import's check step
export function LeftOutSummary({ count }: { count: number }) {
  if (!count) return null
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs">
      <XCircle size={14} className="text-red-600" />
      <span className="font-semibold text-red-700">{count} left out</span>
      <InfoTip align="left" text="No WhatsApp mobile and no working email. Shown below, not imported." />
    </div>
  )
}
