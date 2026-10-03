'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Send, Copy, ExternalLink, Check, AlertTriangle, Info, Lock, PauseCircle, Ban, Phone, RefreshCw } from 'lucide-react'
import { STATUS_STYLE, STEP_LABELS } from '@/lib/config'
import { formatDate, formatDateTime, nextStepLabel } from '@/lib/format'
import { fillPlaceholders, missingPlaceholders } from '@/lib/placeholders'
import { getSendRule, needsPecrConfirm } from '@/lib/sending'
import { facebookLink, instagramLink, isUkMobile, mailtoLink, telLink, whatsappLink } from '@/lib/contact'
import { markSent } from '@/app/dashboard/actions'
import { createClient } from '@/lib/supabase/client'
import { ErrorNote, PlatformIcon, Spinner, StageBadge, StatusBadge } from '@/components/ui'
import type { Profile } from '@/lib/auth'

type Msg = { id: string; direction: 'outbound' | 'inbound' | 'system'; body: string; subject: string | null; step_label: string | null; send_method: string | null; sent_by: string | null; created_at: string }
type Template = { id: string; name: string; platform: string; step: string; services: string[]; subject: string | null; body: string; whatsapp_template_name: string | null }

const STEP_ORDER = ['First contact', 'Follow-up 1', 'Follow-up 2', 'Final check', 'Reply', 'Upsell']

export function ChatInterface({
  thread, opp, draft, templates, siblings, people, me, senderName, apiPlatforms, humanAgent,
}: {
  thread: any; opp: any; draft: any; templates: Template[]; siblings: { id: string; platform: string; status: string }[]
  people: { id: string; full_name: string }[]; me: Profile; senderName: string; apiPlatforms: string[]; humanAgent: boolean
}) {
  const router = useRouter()
  const b = opp.businesses
  const platform: string = thread.platform
  const [messages, setMessages] = useState<Msg[]>(thread.messages || [])
  const bottom = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setMessages(thread.messages || [])
  }, [thread.messages])

  const fill = (text: string) => fillPlaceholders(text, { business_name: b.business_name, sender_name: senderName, area: b.area, contact_name: b.contact_name })

  // Pick the template that matches the next step, if there is no draft
  const stepNow = thread.status === 'Replied' ? 'Reply' : thread.step >= 4 ? null : nextStepLabel(thread.step)
  const defaultTemplate = !draft ? templates.find(t => t.step === stepNow) : undefined

  const [templateId, setTemplateId] = useState<string>(draft?.template_id || defaultTemplate?.id || '')
  const [body, setBody] = useState<string>(draft ? fill(draft.body) : defaultTemplate ? fill(defaultTemplate.body) : '')
  const [subject, setSubject] = useState<string>(draft?.subject ? fill(draft.subject) : platform === 'Email' && defaultTemplate?.subject ? fill(defaultTemplate.subject) : '')
  const [pecrOk, setPecrOk] = useState(false)
  const [opened, setOpened] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncingEmail, setSyncingEmail] = useState(false)
  const [syncStatus, setSyncStatus] = useState<string | null>(null)

  const reloadMessages = async () => {
    try {
      const res = await fetch(`/api/messages?threadId=${thread.id}`)
      if (res.ok) {
        const data = await res.json()
        if (data.messages && Array.isArray(data.messages)) {
          setMessages(data.messages as Msg[])
        }
      }
    } catch {}
  }

  // Load the full up-to-date messages from the database on mount or thread change
  useEffect(() => {
    reloadMessages()
  }, [thread.id])

  const handleSyncEmail = async () => {
    if (syncingEmail) return
    setSyncingEmail(true)
    setSyncStatus(null)
    try {
      const res = await fetch('/api/email/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unseenOnly: false, sinceDays: 7, threadId: thread.id }),
      })
      const data = await res.json()
      if (data.messages && Array.isArray(data.messages)) {
        setMessages(data.messages as Msg[])
      } else {
        await reloadMessages()
      }
      if (data.matched > 0) {
        setSyncStatus(`Found ${data.matched} new ${data.matched === 1 ? 'reply' : 'replies'}`)
      } else {
        setSyncStatus('Up to date')
      }
      router.refresh()
      setTimeout(() => setSyncStatus(null), 3500)
    } catch {
      setSyncStatus('Check failed')
      setTimeout(() => setSyncStatus(null), 3500)
    } finally {
      setSyncingEmail(false)
    }
  }

  const template = templates.find(t => t.id === templateId)
  const rule = getSendRule({
    platform, threadStatus: thread.status, stage: opp.stage, lastInboundAt: thread.last_inbound_at,
    apiPlatforms, whatsappTemplateName: template?.whatsapp_template_name, humanAgent,
  })

  // Permissions (checked again in the database)
  const handedOver = opp.stage === 'Consultation' && !!opp.assigned_consultant_id
  const unassigned = !opp.assigned_sales_id && !opp.assigned_consultant_id
  const canAct = me.role === 'admin' || me.id === opp.assigned_consultant_id || (me.id === opp.assigned_sales_id && !handedOver) || (me.role === 'sales' && unassigned)
  const needsReview = opp.stage === 'Needs review'

  // Where to send manually
  const contactLink = useMemo(() => {
    if (platform === 'WhatsApp') return whatsappLink(b.whatsapp_number || (isUkMobile(b.phone) ? b.phone : null), body)
    if (platform === 'Instagram') return instagramLink(b.instagram)
    if (platform === 'Facebook') return facebookLink(b.facebook)
    if (platform === 'Email') return mailtoLink(b.email, subject, body)
    if (platform === 'Phone') return telLink(b.phone)
    return null
  }, [platform, b, body, subject])
  const missingContact =
    platform === 'WhatsApp' && !b.whatsapp_number && !isUkMobile(b.phone) ? 'No WhatsApp number saved for this business.'
      : platform === 'Instagram' && !b.instagram ? 'No Instagram handle saved.'
        : platform === 'Facebook' && !b.facebook ? 'No Facebook page saved.'
          : platform === 'Email' && !b.email ? 'No email address saved.'
            : platform === 'Phone' && !b.phone ? 'No phone number saved.' : null

  const unfilled = missingPlaceholders(body + ' ' + subject)
  const pecr = needsPecrConfirm(platform, b.company_type)

  // Live updates: new messages on this thread
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`thread-${thread.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'sales-pipe', table: 'messages', filter: `thread_id=eq.${thread.id}` }, (payload) => {
        if (payload?.new) {
          const newMsg = payload.new as Msg
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        }
        reloadMessages()
        router.refresh()
      })
      .subscribe()
    return () => { supabase.removeChannel(ch).catch(() => {}) }
  }, [thread.id, router])

  useEffect(() => {
    if (platform === 'Email') {
      fetch('/api/email/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unseenOnly: true }),
      })
        .then(r => r.json())
        .then(data => {
          if (data?.matched > 0) {
            reloadMessages()
          }
        })
        .catch(() => {})
    }
  }, [platform])

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }) }, [messages.length])
  useEffect(() => {
    const el = area.current
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 320) + 'px' }
  }, [body])

  const pickTemplate = (id: string) => {
    setTemplateId(id)
    const t = templates.find(x => x.id === id)
    if (t) {
      setBody(fill(t.body))
      setSubject(platform === 'Email' && t.subject ? fill(t.subject) : '')
    }
  }

  const blockers = [
    !body.trim() && (rule.mode === 'log' ? 'Write what happened first.' : 'Write a message first.'),
    unfilled.length > 0 && `Fill in ${unfilled.join(', ')} first.`,
    pecr && !pecrOk && rule.mode !== 'log' && 'Confirm consent first (sole trader / partnership).',
    platform === 'Email' && rule.mode !== 'log' && !subject.trim() && 'Add a subject.',
  ].filter(Boolean) as string[]

  const afterSend = () => {
    setBody('')
    setSubject('')
    setTemplateId('')
    setOpened(false)
    setPecrOk(false)
    router.refresh()
  }

  const sendApi = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: thread.id, body, subject: subject || null, templateId: templateId || null, mode: rule.mode, consentConfirmed: pecrOk }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Could not send. Your message is still here.')
      afterSend()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send. Your message is still here.')
    } finally {
      setBusy(false)
    }
  }

  const copyAndOpen = async () => {
    try {
      await navigator.clipboard.writeText(platform === 'Email' && subject ? `${subject}\n\n${body}` : body)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard can be blocked; the link still opens (WhatsApp and email carry the text anyway)
    }
    if (contactLink) window.open(contactLink, platform === 'Email' || platform === 'Phone' ? '_self' : '_blank', 'noopener')
    setOpened(true)
  }

  const markAsSent = async () => {
    setBusy(true)
    setError(null)
    const res = await markSent(thread.id, body, subject || null, templateId || null)
    setBusy(false)
    if (!res.ok) setError(res.error)
    else afterSend()
  }

  // Templates grouped by step for the picker
  const grouped = STEP_ORDER.map(s => [s, templates.filter(t => t.step === s)] as const).filter(([, ts]) => ts.length)

  return (
    <div className="flex h-[calc(100dvh-58px-3rem)] min-h-[560px] flex-col gap-3">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/dashboard/${opp.id}`} className="text-lg font-bold hover:text-primary">{b.business_name}</Link>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <PlatformIcon platform={platform} /> {platform} <StatusBadge status={thread.status} /> <StageBadge stage={opp.stage} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {platform === 'Email' && (
            <button
              onClick={handleSyncEmail}
              disabled={syncingEmail}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-colors"
              title="Check inbox for new customer replies"
            >
              <RefreshCw size={12} className={syncingEmail ? 'animate-spin text-primary' : 'text-slate-500'} />
              <span>{syncStatus || (syncingEmail ? 'Checking...' : 'Check replies')}</span>
            </button>
          )}
          {siblings.map(s => (
            <Link
              key={s.id}
              href={`/dashboard/${opp.id}/thread/${s.id}`}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${s.id === thread.id ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}
            >
              <span className={`h-2 w-2 rounded-full ${STATUS_STYLE[s.status]?.dot ?? 'bg-slate-300'}`} /> {s.platform}
            </Link>
          ))}
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold">
        {STEP_LABELS.map((s, i) => {
          const done = thread.step > i
          return (
            <span key={s} className={`flex items-center gap-1.5 ${done ? 'text-emerald-700' : 'text-slate-400'}`}>
              {done ? <Check size={14} /> : <span className="h-3 w-3 rounded-full border-2 border-current" />} {s}
            </span>
          )
        })}
        {thread.next_due_on && (thread.status === 'Awaiting reply' || thread.status === 'Not contacted') && (
          <span className="ml-auto text-slate-500">Next due {formatDate(thread.next_due_on)}</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No messages yet. The first message is below.</p>}
        {messages.map(m => {
          if (m.direction === 'system') {
            return <div key={m.id} className="flex justify-center"><span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500 shadow-sm">{m.body} · {formatDateTime(m.created_at)}</span></div>
          }
          const ours = m.direction === 'outbound'
          const who = ours ? people.find(p => p.id === m.sent_by)?.full_name : b.contact_name || b.business_name
          return (
            <div key={m.id} className={`flex ${ours ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm sm:max-w-[70%] ${ours ? 'rounded-br-md bg-primary text-white' : 'rounded-bl-md border border-slate-200 bg-white'}`}>
                {m.subject && <div className="mb-1 text-sm font-semibold">{m.subject}</div>}
                <div className="whitespace-pre-wrap break-words text-sm">{m.body}</div>
                <div className={`mt-1 text-[11px] ${ours ? 'text-white/75' : 'text-slate-400'}`}>
                  {[m.step_label, who, formatDateTime(m.created_at), ours && (m.send_method === 'manual' ? (platform === 'Phone' || platform === 'Walk-in' ? 'logged' : 'sent outside the app') : m.send_method === 'api' ? 'sent from here' : null)]
                    .filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottom} />
      </div>

      {/* Banners */}
      {thread.status === 'Paused' && (
        <Banner tone="slate" icon={<PauseCircle size={16} />}>Paused: {String(thread.paused_reason || '').replace(/^Replied on/, 'replied on')}. Carry on the conversation there; you can still message here if needed.</Banner>
      )}
      {rule.mode === 'blocked' && <Banner tone="red" icon={<Ban size={16} />}>{rule.reason}</Banner>}
      {needsReview && <Banner tone="amber" icon={<Info size={16} />}>This lead is waiting for review. Approve it on the business page first.</Banner>}
      {!canAct && rule.mode !== 'blocked' && (
        <Banner tone="slate" icon={<Lock size={16} />}>{handedOver && me.id === opp.assigned_sales_id ? 'Handed over to a consultant. You can read but not send.' : 'You can read this conversation but not send.'}</Banner>
      )}

      {/* Composer */}
      {canAct && !needsReview && rule.mode !== 'blocked' && (
        <div className="card space-y-3 !p-4">
          <div className="flex flex-wrap items-center gap-2">
            {draft && <span className="badge !bg-primary-bg !text-primary">Draft: {draft.step_label}</span>}
            {rule.mode !== 'log' && (
              <select className="input !w-auto min-w-56 !py-1.5" value={templateId} onChange={e => pickTemplate(e.target.value)}>
                <option value="">{templates.length ? 'Pick a template…' : 'No templates for this platform'}</option>
                {grouped.map(([step, ts]) => (
                  <optgroup key={step} label={step}>
                    {ts.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </optgroup>
                ))}
              </select>
            )}
            <span className="ml-auto flex items-center gap-1 text-xs text-slate-500"><Info size={13} /> {rule.reason}</span>
          </div>

          {platform === 'Email' && rule.mode !== 'log' && (
            <input className="input" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
          )}
          <textarea
            ref={area}
            className="input min-h-24 resize-none"
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={rule.mode === 'log' ? (platform === 'Phone' ? 'What happened on the call? Who did you speak to? Next step?' : 'What happened on the visit?') : 'Write your message…'}
          />
          {rule.mode !== 'log' && body && <p className="text-xs text-slate-500">Draft from template. Review before sending.</p>}

          {unfilled.length > 0 && <Banner tone="amber" icon={<AlertTriangle size={16} />}>Missing details: {unfilled.join(', ')}. Replace them in the text, or add the details to the business.</Banner>}
          {missingContact && rule.mode !== 'log' && <Banner tone="amber" icon={<AlertTriangle size={16} />}>{missingContact} <Link href={`/dashboard/${opp.id}`} className="font-semibold underline">Add it</Link></Banner>}
          {pecr && rule.mode !== 'log' && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <input type="checkbox" className="mt-1" checked={pecrOk} onChange={e => setPecrOk(e.target.checked)} />
              Sole traders need prior consent for marketing emails (PECR). Continue only if they agreed.
            </label>
          )}
          <ErrorNote error={error} />

          <div className="flex flex-wrap items-center justify-end gap-2">
            {blockers.length > 0 && <span className="mr-auto text-xs text-slate-500">{blockers[0]}</span>}

            {(rule.mode === 'api' || rule.mode === 'api-template') && (
              <button className="btn btn-primary" disabled={busy || blockers.length > 0 || !!missingContact} onClick={sendApi}>
                {busy ? <Spinner /> : <Send size={16} />} {rule.mode === 'api-template' ? 'Send template' : 'Send'}
              </button>
            )}

            {rule.mode === 'manual' && (
              <>
                <button className="btn btn-secondary" disabled={blockers.length > 0 || !contactLink} onClick={copyAndOpen}>
                  {copied ? <Check size={16} /> : platform === 'Email' ? <ExternalLink size={16} /> : <Copy size={16} />}
                  {platform === 'Email' ? 'Open in email app' : `Copy + open ${platform}`}
                </button>
                <button className={`btn ${opened ? 'btn-primary' : 'btn-secondary'}`} disabled={busy || blockers.length > 0} onClick={markAsSent} title="Click after you have sent it">
                  {busy ? <Spinner /> : <Check size={16} />} Mark as sent
                </button>
              </>
            )}

            {rule.mode === 'log' && (
              <>
                {platform === 'Phone' && contactLink && (
                  <a href={contactLink} className="btn btn-secondary"><Phone size={16} /> Call {b.phone}</a>
                )}
                <button className="btn btn-primary" disabled={busy || blockers.length > 0} onClick={markAsSent}>
                  {busy ? <Spinner /> : <Check size={16} />} Mark as done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Banner({ tone, icon, children }: { tone: 'amber' | 'red' | 'slate'; icon: React.ReactNode; children: React.ReactNode }) {
  const cls = tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-900' : tone === 'red' ? 'border-red-200 bg-red-50 text-red-800' : 'border-slate-200 bg-slate-50 text-slate-700'
  return <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${cls}`}><span className="mt-0.5 shrink-0">{icon}</span><span>{children}</span></div>
}
