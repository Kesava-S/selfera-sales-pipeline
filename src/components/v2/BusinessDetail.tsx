'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Phone, Mail, Globe, MapPin, ExternalLink, StickyNote, Trophy, Handshake, ArrowRightLeft, Plus, UserCheck, Pencil,
  CheckCircle2, AlertTriangle, CalendarClock, Star, Lock,
} from 'lucide-react'
import { CONFIG, OPEN_STAGES } from '@/lib/config'
import { dueLabel, formatDate, formatDateTime } from '@/lib/format'
import { facebookLink, instagramLink, isUkMobile, mailtoLink, telLink, websiteLink, whatsappLink } from '@/lib/contact'
import { addNote, approveLeads, assignConsultant, changeStage, handOver, newPitch, recordWin, startThread } from '@/app/dashboard/actions'
import { ChipSelect, ErrorNote, Modal, PlatformIcon, Spinner, StageBadge, StatusBadge, useAction } from '@/components/ui'
import { BusinessForm } from '@/components/v2/BusinessForm'
import { readiness } from '@/components/v2/LeadsManagement'
import type { Profile } from '@/lib/auth'

type Thread = { id: string; platform: string; status: string; step: number; next_due_on: string | null; paused_reason: string | null; last_inbound_at: string | null; drafts?: { id: string; step_label: string; status: string }[] }
type Person = { id: string; full_name: string; role: string; is_active: boolean }

const PLATFORM_ORDER = ['WhatsApp', 'Instagram', 'Facebook', 'Email', 'Phone', 'Walk-in']

export function BusinessDetail({ opp, otherPitches, people, me }: { opp: any; otherPitches: any[]; people: Person[]; me: Profile }) {
  const router = useRouter()
  const b = opp.businesses
  const threads: Thread[] = [...(opp.threads || [])].sort((x: Thread, y: Thread) => PLATFORM_ORDER.indexOf(x.platform) - PLATFORM_ORDER.indexOf(y.platform))
  const name = (id?: string | null) => people.find(p => p.id === id)?.full_name
  const [modal, setModal] = useState<null | 'stage' | 'handover' | 'win' | 'note' | 'pitch' | 'consultant' | 'edit'>(null)
  const { run, pending, error, setError } = useAction()

  // What this person may do (the database checks again)
  const isAdmin = me.role === 'admin'
  const unassigned = !opp.assigned_sales_id && !opp.assigned_consultant_id
  const handedOver = opp.stage === 'Consultation' && !!opp.assigned_consultant_id
  const canAct =
    isAdmin ||
    me.id === opp.assigned_consultant_id ||
    (me.id === opp.assigned_sales_id && !handedOver) ||
    (me.role === 'sales' && unassigned)
  const needsReview = opp.stage === 'Needs review'
  const closed = ['Won', 'Declined', 'Do not contact'].includes(opp.stage)

  // Platforms we have contact details for but haven't started
  const startable = useMemo(() => {
    const has: Record<string, boolean> = {
      WhatsApp: !!b.whatsapp_number || isUkMobile(b.phone),
      Instagram: !!b.instagram,
      Facebook: !!b.facebook,
      Email: !!b.email,
      Phone: !!b.phone,
      'Walk-in': !!b.address,
    }
    return PLATFORM_ORDER.filter(p => has[p] && !threads.some(t => t.platform === p))
  }, [b, threads])

  const history = useMemo(() => {
    const items = [
      ...(opp.stage_changes || []).map((s: any) => ({
        at: s.created_at, by: name(s.changed_by), kind: 'stage',
        text: s.from_stage === s.to_stage && s.to_services ? `Services changed to ${s.to_services.join(', ')}` : `${s.from_stage ?? 'New'} → ${s.to_stage}`,
        detail: s.reason,
      })),
      ...(opp.notes || []).map((n: any) => ({ at: n.created_at, by: name(n.created_by), kind: 'note', text: 'Note', detail: n.body })),
    ]
    return items.sort((a, z) => (a.at < z.at ? 1 : -1))
  }, [opp.stage_changes, opp.notes, people]) // eslint-disable-line react-hooks/exhaustive-deps

  const ready = needsReview ? readiness({ ...b, services_pitched: opp.services_pitched } as any) : null
  const close = () => { setModal(null); setError(null) }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="!mb-0">{b.business_name}</h1>
            <StageBadge stage={opp.stage} />
            {b.archived && <span className="badge">Archived</span>}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
            <span>{b.business_type}{b.tier ? ` · ${b.tier}` : ''}{b.room_count ? ` · ${b.room_count} rooms` : ''}</span>
            {(b.area || b.postcode) && <span className="flex items-center gap-1"><MapPin size={13} />{[b.area, b.postcode].filter(Boolean).join(', ')}</span>}
            {b.google_rating && <span className="flex items-center gap-1"><Star size={13} className="fill-amber-400 text-amber-400" />{b.google_rating}{b.google_reviews_count ? ` (${b.google_reviews_count})` : ''}</span>}
          </p>
        </div>
        {canAct && (
          <div className="flex flex-wrap gap-2">
            {needsReview && (
              <button className="btn btn-primary" disabled={!!ready || pending} title={ready ?? ''} onClick={() => run(() => approveLeads([b.id]))}>
                {pending ? <Spinner /> : <CheckCircle2 size={16} />} Approve and start outreach
              </button>
            )}
            {!needsReview && !closed && <button className="btn btn-secondary" onClick={() => setModal('stage')}><ArrowRightLeft size={16} /> Change stage</button>}
            {OPEN_STAGES.includes(opp.stage) && opp.stage !== 'Consultation' && <button className="btn btn-secondary" onClick={() => setModal('handover')}><Handshake size={16} /> Hand over</button>}
            {!needsReview && opp.stage !== 'Won' && <button className="btn btn-secondary" onClick={() => setModal('win')}><Trophy size={16} /> Record win</button>}
            {isAdmin && opp.stage === 'Consultation' && <button className="btn btn-secondary" onClick={() => setModal('consultant')}><UserCheck size={16} /> {opp.assigned_consultant_id ? 'Change consultant' : 'Assign consultant'}</button>}
            <button className="btn btn-secondary" onClick={() => setModal('note')}><StickyNote size={16} /> Add note</button>
            <button className="btn btn-secondary" onClick={() => setModal('pitch')}><Plus size={16} /> New pitch</button>
            {closed && <button className="btn btn-ghost" onClick={() => setModal('stage')}><ArrowRightLeft size={16} /> Reopen</button>}
          </div>
        )}
      </div>

      <ErrorNote error={modal ? null : error} />
      {!canAct && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <Lock size={15} /> {handedOver && me.id === opp.assigned_sales_id ? `Handed over to ${name(opp.assigned_consultant_id)}. You can still read everything.` : 'You can view this business but not change it.'}
        </div>
      )}
      {needsReview && ready && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle size={15} /> Before approving: {ready.toLowerCase()}.
        </div>
      )}
      {needsReview && !ready && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Waiting for review. Approving creates a thread for each platform below, assigns a salesperson and drafts the first messages. Nothing is sent until someone clicks Send.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: pitch + contact */}
        <div className="space-y-6">
          <div className="card space-y-3">
            <h2 className="!text-base">This pitch</h2>
            <Row label="Services pitched"><div className="flex flex-wrap gap-1">{opp.services_pitched.map((s: string) => <span key={s} className="badge">{s}</span>)}</div></Row>
            {opp.services_won?.length > 0 && (
              <Row label="Services won">
                <div className="flex flex-wrap gap-1">{opp.services_won.map((s: string) => <span key={s} className="badge !bg-emerald-50 !text-emerald-700">{s}</span>)}</div>
                <span className="text-xs text-slate-500">{opp.conversion_type}{opp.converted_through ? ` · via ${opp.converted_through.toLowerCase()}` : ''}</span>
              </Row>
            )}
            <Row label="Salesperson">{name(opp.assigned_sales_id) || <span className="text-slate-400">Not assigned yet</span>}</Row>
            {(opp.assigned_consultant_id || opp.stage === 'Consultation') && <Row label="Consultant">{name(opp.assigned_consultant_id) || <span className="font-semibold text-amber-700">Needs a consultant</span>}</Row>}
            {opp.consultation_at && <Row label="Consultation"><span className="flex items-center gap-1"><CalendarClock size={14} /> {formatDateTime(opp.consultation_at)}</span></Row>}
            {opp.upsell_reminder_on && <Row label="Upsell reminder">{formatDate(opp.upsell_reminder_on)}</Row>}
            {opp.demo_link && <Row label="Demo"><a href={opp.demo_link} target="_blank" rel="noreferrer" className="text-primary hover:underline">Open demo</a></Row>}
            {otherPitches.length > 0 && (
              <Row label="Other pitches">
                <ul className="space-y-1">
                  {otherPitches.map(p => (
                    <li key={p.id}><Link href={`/dashboard/${p.id}`} className="text-sm text-primary hover:underline">{p.services_pitched.join(', ')}</Link> <span className="text-xs text-slate-500">({p.stage})</span></li>
                  ))}
                </ul>
              </Row>
            )}
          </div>

          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="!text-base">Contact</h2>
              {canAct && <button className="btn btn-ghost btn-sm" onClick={() => setModal('edit')}><Pencil size={14} /> Edit</button>}
            </div>
            {b.contact_name && <Row label="Contact">{b.contact_name}</Row>}
            <ul className="space-y-2 text-sm">
              {b.phone && <Contact icon={<Phone size={15} />} href={telLink(b.phone)} text={b.phone} />}
              {(b.whatsapp_number || isUkMobile(b.phone)) && <Contact icon={<PlatformIcon platform="WhatsApp" size={15} />} href={whatsappLink(b.whatsapp_number || b.phone)} text={`WhatsApp ${b.whatsapp_number || b.phone}`} external />}
              {b.email && <Contact icon={<Mail size={15} />} href={mailtoLink(b.email)} text={b.email} />}
              {b.instagram && <Contact icon={<PlatformIcon platform="Instagram" size={15} />} href={instagramLink(b.instagram)} text={`@${b.instagram}`} external />}
              {b.facebook && <Contact icon={<PlatformIcon platform="Facebook" size={15} />} href={facebookLink(b.facebook)} text="Facebook page" external />}
              {b.existing_website && <Contact icon={<Globe size={15} />} href={websiteLink(b.existing_website)} text={b.existing_website} external />}
              {b.maps_link && <Contact icon={<MapPin size={15} />} href={b.maps_link} text="Google Maps" external />}
              {b.address && <li className="flex items-start gap-2 text-slate-600"><MapPin size={15} className="mt-0.5 shrink-0" />{[b.address, b.postcode].filter(Boolean).join(', ')}</li>}
            </ul>
            <Row label="Company type">
              {b.company_type || 'Unknown'}
              {(b.company_type === 'Sole trader' || b.company_type === 'Partnership') && <span className="block text-xs text-amber-700">Marketing emails need their consent first (PECR).</span>}
            </Row>
            {b.notes && <Row label="Notes"><p className="whitespace-pre-wrap text-sm text-slate-600">{b.notes}</p></Row>}
          </div>
        </div>

        {/* Right: platforms + history */}
        <div className="space-y-6 lg:col-span-2">
          <div>
            <h2 className="mb-3 !text-base">Platforms</h2>
            {threads.length === 0 && needsReview ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Platforms are set up when this lead is approved.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {threads.map(t => {
                  const draft = t.drafts?.find(d => d.status === 'ready' || d.status === 'needs_data')
                  const due = dueLabel(t.status === 'Not contacted' || t.status === 'Awaiting reply' ? t.next_due_on : null)
                  return (
                    <Link key={t.id} href={`/dashboard/${opp.id}/thread/${t.id}`} className="card card-link flex flex-col gap-2 !p-4">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 font-semibold"><PlatformIcon platform={t.platform} size={18} /> {t.platform}</span>
                        <span className="text-xs font-semibold text-slate-500">Step {Math.min(t.step, 4)} of 4</span>
                      </div>
                      <StatusBadge status={t.status} />
                      {t.paused_reason && <span className="text-xs text-slate-500">Paused: {t.paused_reason.replace(/^Replied on/, 'replied on')}</span>}
                      {due.tone !== 'none' && <span className={`text-xs ${due.tone === 'overdue' ? 'font-semibold text-red-600' : due.tone === 'today' ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>{due.tone === 'later' ? `Next: ${due.text}` : due.text}</span>}
                      {draft && <span className={`text-xs font-semibold ${draft.status === 'needs_data' ? 'text-amber-700' : 'text-primary'}`}>{draft.status === 'needs_data' ? 'Draft needs details' : `Draft ready: ${draft.step_label}`}</span>}
                    </Link>
                  )
                })}
                {canAct && !needsReview && opp.stage !== 'Do not contact' && startable.map(p => (
                  <button
                    key={p}
                    disabled={pending}
                    onClick={() => run(() => startThread(opp.id, p), id => id && router.push(`/dashboard/${opp.id}/thread/${id}`))}
                    className="flex flex-col items-start gap-1 rounded-[14px] border border-dashed border-slate-300 bg-white p-4 text-left text-sm text-slate-500 hover:border-primary hover:text-primary"
                  >
                    <span className="flex items-center gap-2 font-semibold"><PlatformIcon platform={p} size={18} /> Start {p}</span>
                    <span className="text-xs">Drafts a first message</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="mb-3 !text-base">History</h2>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing yet.</p>
            ) : (
              <ol className="space-y-3">
                {history.map((h, i) => (
                  <li key={i} className="flex gap-3">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${h.kind === 'note' ? 'bg-amber-400' : 'bg-primary'}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{h.text}</div>
                      {h.detail && <p className="whitespace-pre-wrap text-sm text-slate-600">{h.detail}</p>}
                      <div className="text-xs text-slate-400">{formatDateTime(h.at)}{h.by ? ` · ${h.by}` : ''}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Modals ---------- */}
      {modal === 'stage' && <StageModal opp={opp} onClose={close} />}
      {modal === 'handover' && <HandOverModal opp={opp} onClose={close} />}
      {modal === 'win' && <WinModal opp={opp} onClose={close} />}
      {modal === 'note' && <NoteModal oppId={opp.id} onClose={close} />}
      {modal === 'pitch' && <PitchModal opp={opp} onClose={close} />}
      {modal === 'consultant' && <ConsultantModal opp={opp} people={people} onClose={close} />}
      {modal === 'edit' && <BusinessForm open mode="edit" businessId={b.id} initial={b} onClose={close} />}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  )
}

function Contact({ icon, href, text, external }: { icon: React.ReactNode; href: string | null; text: string; external?: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span className="shrink-0 text-slate-500">{icon}</span>
      {href ? (
        <a href={href} target={external ? '_blank' : undefined} rel="noreferrer" className="truncate text-primary hover:underline">
          {text} {external && <ExternalLink size={11} className="inline" />}
        </a>
      ) : (
        <span className="truncate">{text}</span>
      )}
    </li>
  )
}

function Footer({ onClose, pending, disabled, label, onConfirm, error }: { onClose: () => void; pending: boolean; disabled?: boolean; label: string; onConfirm: () => void; error: string | null }) {
  return (
    <div className="mt-5 space-y-3">
      <ErrorNote error={error} />
      <div className="flex justify-end gap-2">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={pending || disabled} onClick={onConfirm}>{pending && <Spinner />} {label}</button>
      </div>
    </div>
  )
}

function StageModal({ opp, onClose }: { opp: any; onClose: () => void }) {
  const { run, pending, error } = useAction()
  const [stage, setStage] = useState('')
  const [reason, setReason] = useState('')
  // Won goes through "Record win", Consultation through "Hand over", Needs review is only for imports
  const options = CONFIG.STAGES.filter(s => !['Needs review', 'Won', 'Consultation', opp.stage].includes(s))
  return (
    <Modal open onClose={onClose} title="Change stage">
      <label className="label">New stage</label>
      <select className="input" value={stage} onChange={e => setStage(e.target.value)}>
        <option value="">Choose…</option>
        {options.map(s => <option key={s}>{s}</option>)}
      </select>
      {stage === 'Do not contact' && <p className="mt-2 text-xs text-red-700">All platforms are closed and nothing more can be sent to this business.</p>}
      <label className="label mt-4">Reason (optional)</label>
      <input className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Asked us to follow up in spring" />
      <Footer onClose={onClose} pending={pending} disabled={!stage} label="Save" error={error} onConfirm={() => run(() => changeStage(opp.id, stage, reason), onClose)} />
    </Modal>
  )
}

function HandOverModal({ opp, onClose }: { opp: any; onClose: () => void }) {
  const { run, pending, error } = useAction()
  const [when, setWhen] = useState('')
  return (
    <Modal open onClose={onClose} title="Hand over to a consultant">
      <p className="mb-3 text-sm text-slate-600">Moves this pitch to Consultation and asks an admin to assign a consultant. Follow-ups stop.</p>
      <label className="label">Consultation date and time</label>
      <input type="datetime-local" className="input" value={when} onChange={e => setWhen(e.target.value)} />
      <Footer onClose={onClose} pending={pending} disabled={!when} label="Hand over" error={error} onConfirm={() => run(() => handOver(opp.id, new Date(when).toISOString()), onClose)} />
    </Modal>
  )
}

function WinModal({ opp, onClose }: { opp: any; onClose: () => void }) {
  const { run, pending, error } = useAction()
  const [won, setWon] = useState<string[]>(opp.services_pitched)
  const [via, setVia] = useState('')
  const pitched: string[] = opp.services_pitched
  const type = !won.length ? '' :
    won.every(s => pitched.includes(s)) && pitched.every(s => won.includes(s)) ? 'As pitched'
      : pitched.every(s => won.includes(s)) ? 'Expanded'
        : won.every(s => pitched.includes(s)) ? 'Narrowed' : 'Switched'
  return (
    <Modal open onClose={onClose} title="Record win">
      <label className="label">Services won</label>
      <ChipSelect options={CONFIG.SERVICES} value={won} onChange={setWon} />
      {type && <p className="mt-2 text-xs text-slate-500">Pitched {pitched.join(', ')}. This is recorded as <b>{type}</b>.</p>}
      <label className="label mt-4">How was it won?</label>
      <select className="input" value={via} onChange={e => setVia(e.target.value)}>
        <option value="">Choose…</option>
        {CONFIG.CONVERTED_THROUGH.map(c => <option key={c}>{c}</option>)}
      </select>
      <Footer onClose={onClose} pending={pending} disabled={!won.length || !via} label="Record win" error={error} onConfirm={() => run(() => recordWin(opp.id, won, via), onClose)} />
    </Modal>
  )
}

function NoteModal({ oppId, onClose }: { oppId: string; onClose: () => void }) {
  const { run, pending, error } = useAction()
  const [text, setText] = useState('')
  return (
    <Modal open onClose={onClose} title="Add note">
      <textarea className="input min-h-28" value={text} onChange={e => setText(e.target.value)} autoFocus placeholder="What happened, what they said, next step…" />
      <Footer onClose={onClose} pending={pending} disabled={!text.trim()} label="Save note" error={error} onConfirm={() => run(() => addNote(oppId, text), onClose)} />
    </Modal>
  )
}

function PitchModal({ opp, onClose }: { opp: any; onClose: () => void }) {
  const router = useRouter()
  const { run, pending, error } = useAction()
  const [services, setServices] = useState<string[]>([])
  return (
    <Modal open onClose={onClose} title="New pitch to this business">
      <p className="mb-3 text-sm text-slate-600">Starts a separate pitch (for example an upsell). It goes to the review queue first.</p>
      <ChipSelect options={CONFIG.SERVICES} value={services} onChange={setServices} />
      <Footer
        onClose={onClose} pending={pending} disabled={!services.length} label="Create pitch" error={error}
        onConfirm={() => run(() => newPitch(opp.business_id, services, opp.id), id => { onClose(); if (id) router.push(`/dashboard/${id}`) })}
      />
    </Modal>
  )
}

function ConsultantModal({ opp, people, onClose }: { opp: any; people: Person[]; onClose: () => void }) {
  const { run, pending, error } = useAction()
  const [who, setWho] = useState(opp.assigned_consultant_id || '')
  const consultants = people.filter(p => p.role === 'consultant' && p.is_active)
  return (
    <Modal open onClose={onClose} title="Assign consultant">
      {consultants.length === 0 ? (
        <p className="text-sm text-slate-600">There are no consultants yet. Set someone&apos;s role to consultant first (see docs/admin-setup.md).</p>
      ) : (
        <select className="input" value={who} onChange={e => setWho(e.target.value)}>
          <option value="">Choose…</option>
          {consultants.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
      )}
      <Footer onClose={onClose} pending={pending} disabled={!who} label="Assign" error={error} onConfirm={() => run(() => assignConsultant(opp.id, who), onClose)} />
    </Modal>
  )
}
