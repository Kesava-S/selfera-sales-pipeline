'use client'

// Client Audience: campaigns to one client's customers, sent in the client's
// name. They unlock while the business is Won and its data-processing agreement is
// recorded; if it stops being Won, unsent messages wait until it is Won again.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, CircleSlash, Mail, MessageCircle, Pencil, Plus, Send, ShieldCheck } from 'lucide-react'
import { launchAudienceCampaign, previewAudience, saveAudienceClient, type AudienceFilter, type AudiencePreview } from '@/app/dashboard/audience/actions'
import { CampaignProgress } from '@/components/v2/CampaignProgress'
import { EmptyState, ErrorNote, Modal, Spinner, useAction } from '@/components/ui'
import { formatDate } from '@/lib/format'

export type AudienceCampaignRow = {
  id: string; channel: 'email' | 'whatsapp'; name: string; subject: string | null
  status: string; recipient_count: number | null; created_at: string; sent_at: string | null
}
type Settings = { dpaSignedOn: string | null; senderName: string; replyTo: string }
type Business = { id: string; business_name: string; email?: string | null }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function AudienceCampaigns({ business, isAdmin, won, settings, campaigns, tags }: {
  business: Business; isAdmin: boolean; won: boolean; settings: Settings; campaigns: AudienceCampaignRow[]; tags: string[]
}) {
  const [editing, setEditing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [report, setReport] = useState<AudienceCampaignRow | null>(null)
  const unlocked = won && !!settings.dpaSignedOn
  const sender = settings.senderName || business.business_name
  const replyTo = settings.replyTo || business.email || null

  return (
    <div className="space-y-5">
      <section className="card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold">Campaigns for {business.business_name}</h2>
            <p className="text-sm text-slate-500">Email and WhatsApp, sent in the client&apos;s name. Each person gets at most one message per gap set in Settings.</p>
          </div>
          {isAdmin && <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}><Pencil size={14} /> Client settings</button>}
        </div>
        <ul className="space-y-1.5 text-sm">
          <Check ok={won} yes="Won in Lead Management" no="Not Won in Lead Management. Campaigns unlock (or resume) when the business is Won." />
          <Check ok={!!settings.dpaSignedOn} yes={`Data-processing agreement signed ${settings.dpaSignedOn ? formatDate(settings.dpaSignedOn) : ''}`} no={`No data-processing agreement recorded${isAdmin ? '. Add the signing date in Client settings.' : '. Ask an admin to record it.'}`} />
        </ul>
        <p className="text-xs text-slate-500">
          Emails show <b className="font-semibold text-slate-700">{sender}</b> as the sender{replyTo ? <>, and replies go to <b className="font-semibold text-slate-700">{replyTo}</b></> : ' (no reply address set)'}.
        </p>
        <div className="flex justify-end">
          <button className="btn btn-primary" disabled={!unlocked} title={unlocked ? '' : 'Needs Won and a recorded agreement'} onClick={() => setCreating(true)}>
            <Plus size={16} /> New campaign
          </button>
        </div>
      </section>

      {campaigns.length === 0 ? (
        <EmptyState icon={<Send size={36} />} title="No campaigns yet" text={unlocked ? 'Start one to message this client’s ready customers.' : undefined} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Campaign</th><th>Status</th><th>Progress</th><th /></tr></thead>
            <tbody>
              {campaigns.map(c => {
                const paused = c.status === 'sending' && !unlocked
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="flex items-center gap-2 font-semibold text-slate-900">
                        {c.channel === 'email' ? <Mail size={14} className="text-slate-400" /> : <MessageCircle size={14} className="text-emerald-600" />}
                        {c.name}
                      </div>
                      <div className="text-xs text-slate-500">{c.subject ? `${c.subject} · ` : ''}{formatDate(c.created_at)}</div>
                    </td>
                    <td>
                      <span className={`badge ${paused ? '!border-amber-200 !bg-amber-50 !text-amber-700' : c.status === 'sent' ? '!border-emerald-200 !bg-emerald-50 !text-emerald-700' : '!border-sky-200 !bg-sky-50 !text-sky-700'}`}>
                        {paused ? 'Paused' : c.status === 'sent' ? 'Sent' : 'Sending'}
                      </span>
                    </td>
                    <td className="min-w-48"><CampaignProgress compact channel={c.channel} campaignId={c.id} /></td>
                    <td className="text-right"><button className="btn btn-secondary btn-sm" onClick={() => setReport(c)}>Report</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && <ClientSettings business={business} settings={settings} onClose={() => setEditing(false)} />}
      {creating && <NewCampaign business={business} tags={tags} onClose={() => setCreating(false)} />}
      <Modal open={!!report} onClose={() => setReport(null)} title={report ? `Report · ${report.name}` : 'Report'}>
        {report && <CampaignProgress audience channel={report.channel} campaignId={report.id} />}
      </Modal>
    </div>
  )
}

function Check({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <li className={`flex items-start gap-2 ${ok ? 'text-emerald-700' : 'text-amber-800'}`}>
      {ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <CircleSlash size={16} className="mt-0.5 shrink-0" />}
      {ok ? yes : no}
    </li>
  )
}

function ClientSettings({ business, settings, onClose }: { business: Business; settings: Settings; onClose: () => void }) {
  const [dpa, setDpa] = useState(settings.dpaSignedOn ?? '')
  const [senderName, setSenderName] = useState(settings.senderName)
  const [replyTo, setReplyTo] = useState(settings.replyTo)
  const { run, pending, error } = useAction()
  return (
    <Modal open onClose={onClose} locked={pending} title="Client settings">
      <div className="space-y-3">
        <div>
          <label className="label flex items-center gap-1.5"><ShieldCheck size={14} /> Data-processing agreement signed on</label>
          <input className="input" type="date" max={new Date().toISOString().slice(0, 10)} value={dpa} onChange={e => setDpa(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">We process the client&apos;s customer data for them, so a signed agreement is needed before any campaign. Clear the date to lock campaigns.</p>
        </div>
        <div>
          <label className="label">Sender name on emails</label>
          <input className="input" placeholder={business.business_name} value={senderName} onChange={e => setSenderName(e.target.value)} />
        </div>
        <div>
          <label className="label">Replies go to</label>
          <input className="input" type="email" placeholder={business.email || 'client@example.com'} value={replyTo} onChange={e => setReplyTo(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">Usually the client&apos;s own email. Empty uses the business email from Lead Management.</p>
        </div>
      </div>
      <ErrorNote error={error} />
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn btn-secondary" disabled={pending} onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={pending} onClick={() => run(() => saveAudienceClient(business.id, { dpaSignedOn: dpa || null, senderName, replyTo }), onClose, { success: 'Client settings saved.' })}>
          {pending && <Spinner />} Save
        </button>
      </div>
    </Modal>
  )
}

function NewCampaign({ business, tags, onClose }: { business: Business; tags: string[]; onClose: () => void }) {
  const router = useRouter()
  const [channel, setChannel] = useState<'email' | 'whatsapp'>('email')
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('Hi {first_name},\n\n')
  const [templateName, setTemplateName] = useState('')
  const [message, setMessage] = useState('Hi {first_name}, ')
  const [pickedTags, setPickedTags] = useState<string[]>([])
  const [months, setMonths] = useState<number[]>([])
  const [visit, setVisit] = useState<'any' | 'within' | 'not'>('any')
  const [days, setDays] = useState(90)
  const [country, setCountry] = useState('UK')
  const [mobileOnly, setMobileOnly] = useState(false)
  const [preview, setPreview] = useState<AudiencePreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const { run, pending, error } = useAction()

  const filter: AudienceFilter = {
    tags: pickedTags,
    birthday_months: months,
    country: country || undefined,
    visited_within_days: visit === 'within' ? days : null,
    not_visited_days: visit === 'not' ? days : null,
    mobile_only: channel === 'email' && mobileOnly,
  }
  const key = JSON.stringify({ channel, filter })

  // Live count of who it goes to
  useEffect(() => {
    let live = true
    const t = setTimeout(() => {
      previewAudience(business.id, channel, JSON.parse(key).filter)
        .catch(() => ({ ok: false as const, error: 'Could not count the audience.' }))
        .then(res => {
          if (!live) return
          if (res.ok) { setPreview(res.data!); setPreviewError(null) } else setPreviewError(res.error)
        })
    }, 300)
    return () => { live = false; clearTimeout(t) }
  }, [business.id, channel, key])

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])
  const ready = name.trim() && (channel === 'email' ? subject.trim() && body.trim() : message.trim())
  const send = () => run(
    () => launchAudienceCampaign(business.id, { channel, name, subject, body, message, templateName, filter }),
    () => { onClose(); router.refresh() },
    { success: d => `Campaign started: ${d?.queued ?? 0} queued${d?.skipped ? `, ${d.skipped} skipped` : ''}.` },
  )

  return (
    <Modal open onClose={onClose} locked={pending} wide title="New campaign">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(['email', 'whatsapp'] as const).map(c => (
            <button key={c} type="button" className={`chip ${channel === c ? 'active' : ''}`} onClick={() => setChannel(c)}>
              {c === 'email' ? <Mail size={14} /> : <MessageCircle size={14} />} {c === 'email' ? 'Email' : 'WhatsApp'}
            </button>
          ))}
        </div>
        <div>
          <label className="label">Campaign name (only we see this) <span className="text-red-500 font-bold ml-0.5">*</span></label>
          <input className="input" placeholder="e.g. Spring offer" value={name} onChange={e => setName(e.target.value)} />
        </div>

        {channel === 'email' ? (
          <>
            <div>
              <label className="label">Subject <span className="text-red-500 font-bold ml-0.5">*</span></label>
              <input className="input" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div>
              <label className="label">Message <span className="text-red-500 font-bold ml-0.5">*</span></label>
              <textarea className="input min-h-40" value={body} onChange={e => setBody(e.target.value)} />
              <p className="mt-1 text-xs text-slate-500">Use {'{first_name}'} and {'{client_name}'}. An opt-out link is added at the bottom.</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="label">WhatsApp template name <span className="text-red-500 font-bold ml-0.5">*</span></label>
              <input className="input" placeholder="approved_marketing_template" value={templateName} onChange={e => setTemplateName(e.target.value)} />
              <p className="mt-1 text-xs text-slate-500">WhatsApp only allows marketing messages through a template Meta has approved. The message below fills the template&apos;s text.</p>
            </div>
            <div>
              <label className="label">Message <span className="text-red-500 font-bold ml-0.5">*</span></label>
              <textarea className="input min-h-28" value={message} onChange={e => setMessage(e.target.value)} />
              <p className="mt-1 text-xs text-slate-500">Use {'{first_name}'} and {'{client_name}'}. Replies of STOP or OPT OUT stop messages from this client.</p>
            </div>
          </>
        )}

        <div className="space-y-3 rounded-xl border border-slate-200 p-3">
          <p className="text-sm font-semibold text-slate-800">Who it goes to</p>
          {tags.length > 0 && (
            <div>
              <label className="label">Tags (any of)</label>
              <div className="flex flex-wrap gap-1.5">{tags.map(t => <button key={t} type="button" className={`chip !py-1 ${pickedTags.includes(t) ? 'active' : ''}`} onClick={() => setPickedTags(toggle(pickedTags, t))}>{t}</button>)}</div>
            </div>
          )}
          <div>
            <label className="label">Birthday month</label>
            <div className="flex flex-wrap gap-1.5">{MONTHS.map((m, i) => <button key={m} type="button" className={`chip !py-1 ${months.includes(i + 1) ? 'active' : ''}`} onClick={() => setMonths(toggle(months, i + 1))}>{m}</button>)}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="label !mb-0">Last visit</label>
            <select className="input !w-auto" value={visit} onChange={e => setVisit(e.target.value as typeof visit)}>
              <option value="any">Any time</option>
              <option value="within">Visited in the last</option>
              <option value="not">Not visited for</option>
            </select>
            {visit !== 'any' && <><input className="input !w-20 text-right" type="number" min={1} max={3650} value={days} onChange={e => setDays(Number(e.target.value))} /> days</>}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              Country
              <select className="input !w-auto" value={country} onChange={e => setCountry(e.target.value)}>
                <option value="UK">UK</option>
                <option value="India">India</option>
                <option value="">Both</option>
              </select>
            </label>
            {channel === 'email' && (
              <label className="flex items-center gap-2"><input type="checkbox" checked={mobileOnly} onChange={e => setMobileOnly(e.target.checked)} /> Only customers with a mobile</label>
            )}
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            {previewError ? <span className="text-red-600">{previewError}</span> : !preview ? <span className="flex items-center gap-2 text-slate-500"><Spinner size={14} /> Counting…</span> : (
              <>
                <b className="text-slate-900">Goes to {preview.send.toLocaleString('en-GB')} customer{preview.send === 1 ? '' : 's'}.</b>
                {Object.keys(preview.skipped).length > 0 && (
                  <span className="text-slate-500"> Left out: {Object.entries(preview.skipped).map(([reason, n]) => `${n.toLocaleString('en-GB')} ${reason.toLowerCase()}`).join(' · ')}.</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <ErrorNote error={error} />
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn btn-secondary" disabled={pending} onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={pending || !ready || !preview?.send} onClick={() => {
          if (window.confirm(`Send "${name}" to ${preview?.send} customers of ${business.business_name} now?`)) send()
        }}>
          {pending ? <Spinner /> : <Send size={16} />} Send to {preview?.send?.toLocaleString('en-GB') ?? '…'}
        </button>
      </div>
    </Modal>
  )
}
