'use client'

// Create / edit a WhatsApp message template, laid out like Meta's WhatsApp Manager:
// 1. Set up template (category, name, language) → 2. Edit template (header, body,
// footer, buttons, variable samples) → 3. Review and submit. Live phone preview.

import { Fragment, useRef, useState } from 'react'
import {
  ArrowLeft, BadgeCheck, BatteryFull, Bell, Bold, Camera, Check, ChevronDown, ChevronLeft, Code, ExternalLink, Italic,
  KeyRound, Megaphone, Mic, MoreVertical, Paperclip, Phone, Plus, Reply, Signal, Smile, Strikethrough, Trash2, Video, Wifi,
} from 'lucide-react'
import { submitMetaTemplate, updateMetaTemplate } from '@/app/dashboard/templates/metaActions'
import {
  checkDraft, fromComponents, variablesIn, VAR_KEYS, VAR_LABELS,
  type MetaButton, type MetaCategory, type MetaComponent, type TemplateDraft, type VarKey, type VariableMap,
} from '@/lib/metaTemplateDraft'
import { ErrorNote, Modal, Spinner, useAction } from '@/components/ui'

export const LANGUAGES = [
  { code: 'en_GB', label: 'English (UK)' },
  { code: 'en_US', label: 'English (US)' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ta', label: 'Tamil' },
]

type EditorRow = { id: string; name: string; language: string; category: MetaCategory; status: string; components: MetaComponent[]; variable_map: VariableMap | null }

const EMPTY: TemplateDraft = {
  name: 'selfera_', language: 'en_GB', category: 'MARKETING', header: '', headerExample: '',
  body: '', bodyExamples: [], footer: '', buttons: [],
}

const CATEGORIES: { value: MetaCategory; title: string; text: string; icon: React.ReactNode; disabled?: boolean }[] = [
  { value: 'MARKETING', title: 'Marketing', text: 'Outreach, offers and announcements to start or restart a conversation.', icon: <Megaphone size={18} /> },
  { value: 'UTILITY', title: 'Utility', text: 'Updates about something the person already did or asked for, such as a booking.', icon: <Bell size={18} /> },
  { value: 'AUTHENTICATION', title: 'Authentication', text: 'One-time passcodes. Not used in Selfera Sales.', icon: <KeyRound size={18} />, disabled: true },
]

const STEPS = ['Set up template', 'Edit template', 'Review and submit']

export function MetaTemplateEditor({ row, statusLabel, initial, initialMap, onClose, onCreated }: {
  row: EditorRow | null
  statusLabel?: string
  initial?: TemplateDraft
  initialMap?: VariableMap
  onClose: () => void
  onCreated: (name: string) => void
}) {
  const [d, setD] = useState<TemplateDraft>(row ? fromComponents(row) : initial ?? EMPTY)
  const [vmap, setVmap] = useState<VariableMap>({ body: [], ...(row?.variable_map ?? initialMap ?? {}) })
  const [step, setStep] = useState(row ? 1 : 0)
  const [headerOn, setHeaderOn] = useState(!!d.header)
  const { run, pending, error } = useAction()
  const set = (patch: Partial<TemplateDraft>) => setD(prev => ({ ...prev, ...patch }))
  const vars = variablesIn(d.body)
  const mapFor = (i: number): VarKey => vmap.body[i] ?? 'message'
  const problems = checkDraft(d)
  const approved = row?.status === 'APPROVED'
  const setupOk = /^[a-z0-9_]{1,512}$/.test(d.name) && !!d.language

  const save = () => {
    const m: VariableMap = { ...vmap, body: vars.map((_, i) => mapFor(i)) }
    if (row) run(() => updateMetaTemplate(row.id, d, m), onClose, { success: 'Changes sent to Meta for review.' })
    else run(() => submitMetaTemplate(d, m), data => onCreated(data?.name ?? d.name), { success: 'Template sent to Meta for review. It can be used once approved.' })
  }

  return (
    <Modal open onClose={onClose} locked={pending} wide="xl" title={row ? `Edit template · ${row.name}` : 'Create template'}>
      <Stepper step={step} onStep={i => (row ? i >= 1 : i === 0 || setupOk) && setStep(i)} locked={!!row} />

      {step === 0 && <SetUp d={d} set={set} />}

      {step === 1 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            {row && (
              <p className={`rounded-lg px-3 py-2 text-xs ${approved ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-600'}`}>
                {approved
                  ? 'This template is approved. Saving sends it back to Meta for review, and Meta limits how often an approved template can be edited (about once a day, 10 times a month). For bigger changes, create a new template.'
                  : `Status: ${statusLabel ?? row.status}. Saving sends it to Meta for review again.`}
              </p>
            )}
            <Content d={d} set={set} headerOn={headerOn} setHeaderOn={setHeaderOn} vars={vars} mapFor={mapFor} setVmap={setVmap} vmap={vmap} />
            {problems.length > 0 && <Problems problems={problems} />}
          </div>
          <div className="lg:sticky lg:top-0 lg:self-start"><Preview d={d} /></div>
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <Card title="Template details">
              <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
                <dt className="text-slate-500">Name</dt><dd className="font-mono text-slate-900">{d.name}</dd>
                <dt className="text-slate-500">Category</dt><dd className="text-slate-900">{CATEGORIES.find(c => c.value === d.category)?.title}</dd>
                <dt className="text-slate-500">Language</dt><dd className="text-slate-900">{LANGUAGES.find(l => l.code === d.language)?.label ?? d.language}</dd>
                <dt className="text-slate-500">Buttons</dt><dd className="text-slate-900">{d.buttons.length ? d.buttons.map(b => b.text).join(', ') : 'None'}</dd>
              </dl>
            </Card>
            {vars.length > 0 && (
              <Card title="Filled in for each lead">
                <ul className="space-y-1 text-sm">
                  {vars.map((v, i) => (
                    <li key={v} className="flex gap-3"><span className="w-12 font-mono text-slate-500">{`{{${v}}}`}</span><span className="text-slate-900">{VAR_LABELS[mapFor(i)]}</span><span className="text-slate-400">e.g. {d.bodyExamples[i]}</span></li>
                  ))}
                </ul>
              </Card>
            )}
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              Meta usually reviews templates within a few minutes, and at most 24 hours. The status updates here when Meta replies. It can only be sent once it&apos;s <b>Approved</b>.
            </div>
            {problems.length > 0 && <Problems problems={problems} />}
          </div>
          <div className="lg:sticky lg:top-0 lg:self-start"><Preview d={d} /></div>
        </div>
      )}

      <ErrorNote error={error} />
      <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
        <div>
          {step > (row ? 1 : 0) && (
            <button className="btn btn-ghost" disabled={pending} onClick={() => setStep(step - 1)}><ChevronLeft size={16} /> Back</button>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" disabled={pending} onClick={onClose}>Cancel</button>
          {step < 2 ? (
            <button className="btn btn-primary" disabled={step === 0 ? !setupOk : problems.length > 0} onClick={() => setStep(step + 1)}>Next</button>
          ) : (
            <button className="btn btn-primary" disabled={pending || problems.length > 0} onClick={save}>
              {pending && <Spinner />} {row ? 'Submit changes for review' : 'Submit for review'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ---------- Pieces ----------

function Stepper({ step, onStep, locked }: { step: number; onStep: (i: number) => void; locked: boolean }) {
  return (
    <ol className="mb-5 flex flex-wrap items-center gap-2 text-sm">
      {STEPS.map((label, i) => {
        const done = i < step
        const active = i === step
        const disabled = locked && i === 0
        return (
          <Fragment key={label}>
            {i > 0 && <li aria-hidden className="h-px w-6 bg-slate-200 sm:w-10" />}
            <li>
              <button type="button" disabled={disabled} onClick={() => onStep(i)}
                className={`flex items-center gap-2 rounded-full px-1 py-0.5 ${disabled ? 'cursor-default opacity-50' : ''}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  active ? 'bg-primary text-white' : done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {done ? <Check size={13} /> : i + 1}
                </span>
                <span className={active ? 'font-semibold text-slate-900' : 'text-slate-500'}>{label}</span>
              </button>
            </li>
          </Fragment>
        )
      })}
    </ol>
  )
}

function Card({ title, optional, hint, children }: { title: string; optional?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">
        {title} {optional && <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">Optional</span>}
      </h3>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

const Count = ({ n, max }: { n: number; max: number }) => (
  <span className={`text-[11px] ${n > max ? 'text-red-600' : 'text-slate-400'}`}>{n}/{max}</span>
)

function Problems({ problems }: { problems: string[] }) {
  return (
    <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      {problems.map(p => <li key={p}>• {p}</li>)}
    </ul>
  )
}

function SetUp({ d, set }: { d: TemplateDraft; set: (p: Partial<TemplateDraft>) => void }) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card title="Choose the category" hint="Meta checks the category during review and may change it.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CATEGORIES.map(c => {
            const on = d.category === c.value
            return (
              <button key={c.value} type="button" disabled={c.disabled} onClick={() => set({ category: c.value })}
                className={`rounded-xl border p-3 text-left transition ${on ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-slate-200 hover:border-slate-300'} ${c.disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${on ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'}`}>{c.icon}</span>
                  <span className={`h-4 w-4 rounded-full border ${on ? 'border-[5px] border-primary' : 'border-slate-300'}`} />
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-900">{c.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{c.text}</p>
              </button>
            )
          })}
        </div>
      </Card>
      <Card title="Name and language">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
          <div>
            <div className="flex items-center justify-between"><label className="label !mb-1">Template name</label><Count n={d.name.length} max={512} /></div>
            <input className="input font-mono" placeholder="selfera_first_contact" value={d.name}
              onChange={e => set({ name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} />
            <p className="mt-1 text-[11px] text-slate-500">Lowercase letters, numbers and underscores. Start with <code>selfera_</code> so it&apos;s clear in the shared Meta account.</p>
          </div>
          <div>
            <label className="label !mb-1">Language</label>
            <select className="input" value={d.language} onChange={e => set({ language: e.target.value })}>
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
        </div>
      </Card>
    </div>
  )
}

function Content({ d, set, headerOn, setHeaderOn, vars, mapFor, vmap, setVmap }: {
  d: TemplateDraft; set: (p: Partial<TemplateDraft>) => void; headerOn: boolean; setHeaderOn: (v: boolean) => void
  vars: number[]; mapFor: (i: number) => VarKey; vmap: VariableMap; setVmap: (m: VariableMap) => void
}) {
  const body = useRef<HTMLTextAreaElement>(null)
  const [menu, setMenu] = useState(false)

  // Bold / italic / strikethrough / monospace, the way WhatsApp writes them
  const wrap = (mark: string) => {
    const el = body.current
    if (!el) return
    const { selectionStart: a, selectionEnd: b } = el
    const picked = d.body.slice(a, b) || 'text'
    set({ body: d.body.slice(0, a) + mark + picked + mark + d.body.slice(b) })
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + mark.length, a + mark.length + picked.length) })
  }
  const addVariable = () => {
    const el = body.current
    const at = el?.selectionStart ?? d.body.length
    const token = `{{${vars.length + 1}}}`
    set({ body: d.body.slice(0, at) + token + d.body.slice(at), bodyExamples: [...d.bodyExamples, ''] })
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + token.length, at + token.length) })
  }
  const setButton = (i: number, b: MetaButton) => set({ buttons: d.buttons.map((x, j) => (j === i ? b : x)) })
  const addButton = (b: MetaButton) => { set({ buttons: [...d.buttons, b] }); setMenu(false) }
  const headerHasVar = variablesIn(d.header || '').length > 0

  return (
    <>
      <Card title="Header" optional hint="A bold title at the top of the message.">
        <select className="input !w-48" value={headerOn ? 'TEXT' : 'NONE'}
          onChange={e => { const on = e.target.value === 'TEXT'; setHeaderOn(on); if (!on) set({ header: '', headerExample: '' }) }}>
          <option value="NONE">None</option>
          <option value="TEXT">Text</option>
        </select>
        {headerOn && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <input className="input" maxLength={60} placeholder="e.g. A quick idea for {{1}}" value={d.header} onChange={e => set({ header: e.target.value })} />
              <Count n={(d.header || '').length} max={60} />
            </div>
            {!headerHasVar && (
              <button type="button" className="text-xs font-semibold text-primary" onClick={() => set({ header: `${(d.header || '').trimEnd()} {{1}}` })}>+ Add variable</button>
            )}
          </div>
        )}
      </Card>

      <Card title="Body" hint="The main message. Variables like {{1}} are filled in for each lead.">
        <textarea ref={body} className="input min-h-40 rounded-b-none" maxLength={1024} placeholder="Hi {{1}}, …" value={d.body} onChange={e => set({ body: e.target.value })} />
        <div className="flex flex-wrap items-center gap-1 rounded-b-lg border border-t-0 border-slate-200 bg-slate-50 px-2 py-1">
          <ToolButton label="Bold" onClick={() => wrap('*')}><Bold size={14} /></ToolButton>
          <ToolButton label="Italic" onClick={() => wrap('_')}><Italic size={14} /></ToolButton>
          <ToolButton label="Strikethrough" onClick={() => wrap('~')}><Strikethrough size={14} /></ToolButton>
          <ToolButton label="Monospace" onClick={() => wrap('```')}><Code size={14} /></ToolButton>
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <button type="button" className="rounded px-2 py-1 text-xs font-semibold text-primary hover:bg-white" onClick={addVariable}><Plus size={12} className="inline" /> Add variable</button>
          <span className="ml-auto"><Count n={d.body.length} max={1024} /></span>
        </div>
      </Card>

      {(vars.length > 0 || headerHasVar) && (
        <Card title="Variable samples" hint="Meta needs a sample of each variable to review the template. Choose what fills it for each lead.">
          <div className="space-y-2">
            {headerHasVar && (
              <div className="grid grid-cols-[56px_1fr] items-center gap-2 sm:grid-cols-[56px_180px_1fr]">
                <span className="font-mono text-xs text-slate-500">Header {'{{1}}'}</span>
                <select className="input text-xs" value={vmap.header || 'business_name'} onChange={e => setVmap({ ...vmap, header: e.target.value as VarKey })}>
                  {VAR_KEYS.filter(k => k !== 'message').map(k => <option key={k} value={k}>{VAR_LABELS[k]}</option>)}
                </select>
                <input className="input col-span-2 sm:col-span-1" placeholder="Sample" value={d.headerExample} onChange={e => set({ headerExample: e.target.value })} />
              </div>
            )}
            {vars.map((v, i) => (
              <div key={v} className="grid grid-cols-[56px_1fr] items-center gap-2 sm:grid-cols-[56px_180px_1fr]">
                <span className="font-mono text-xs text-slate-500">{`{{${v}}}`}</span>
                <select className="input text-xs" value={mapFor(i)}
                  onChange={e => { const b = vars.map((_, j) => mapFor(j)); b[i] = e.target.value as VarKey; setVmap({ ...vmap, body: b }) }}>
                  {VAR_KEYS.map(k => <option key={k} value={k}>{VAR_LABELS[k]}</option>)}
                </select>
                <input className="input col-span-2 sm:col-span-1" placeholder="Sample" value={d.bodyExamples[i] ?? ''}
                  onChange={e => { const ex = [...d.bodyExamples]; ex[i] = e.target.value; set({ bodyExamples: ex }) }} />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Footer" optional hint="Small grey text under the message.">
        <div className="flex items-center gap-2">
          <input className="input" maxLength={60} placeholder="e.g. Reply STOP to opt out" value={d.footer} onChange={e => set({ footer: e.target.value })} />
          <Count n={(d.footer || '').length} max={60} />
        </div>
      </Card>

      <Card title="Buttons" optional hint="Up to 3 buttons people can tap. A marketing opt-out button lets people stop messages in one tap.">
        <div className="space-y-2">
          {d.buttons.map((b, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  {b.type === 'URL' ? <ExternalLink size={13} /> : b.type === 'PHONE_NUMBER' ? <Phone size={13} /> : <Reply size={13} />}
                  {b.type === 'URL' ? 'Visit website' : b.type === 'PHONE_NUMBER' ? 'Call phone number' : 'Quick reply'}
                </span>
                <button type="button" className="btn btn-ghost btn-sm !p-1 !text-red-700" onClick={() => set({ buttons: d.buttons.filter((_, j) => j !== i) })} aria-label="Remove button"><Trash2 size={14} /></button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[200px_1fr]">
                <div className="flex items-center gap-2">
                  <input className="input" maxLength={25} placeholder="Button text" value={b.text} onChange={e => setButton(i, { ...b, text: e.target.value })} />
                  <Count n={b.text.length} max={25} />
                </div>
                {b.type === 'URL' && <input className="input" placeholder="https://www.example.com" value={b.url} onChange={e => setButton(i, { ...b, url: e.target.value })} />}
                {b.type === 'PHONE_NUMBER' && <input className="input" placeholder="+447911123456" value={b.phone_number} onChange={e => setButton(i, { ...b, phone_number: e.target.value })} />}
              </div>
            </div>
          ))}
          {d.buttons.length < 3 && (
            <div className="relative">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMenu(!menu)}><Plus size={14} /> Add button <ChevronDown size={14} /></button>
              {menu && (
                <div className="absolute bottom-full z-10 mb-1 w-64 rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-lg">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Quick reply buttons</p>
                  <MenuItem onClick={() => addButton({ type: 'QUICK_REPLY', text: 'Stop promotions' })} title="Marketing opt-out" text="Lets people stop messages" />
                  <MenuItem onClick={() => addButton({ type: 'QUICK_REPLY', text: '' })} title="Custom" text="Your own short reply" />
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Call-to-action buttons</p>
                  <MenuItem onClick={() => addButton({ type: 'URL', text: 'Visit website', url: 'https://' })} title="Visit website" text="Opens a link" />
                  <MenuItem onClick={() => addButton({ type: 'PHONE_NUMBER', text: 'Call us', phone_number: '+44' })} title="Call phone number" text="Starts a phone call" />
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </>
  )
}

const ToolButton = ({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) => (
  <button type="button" title={label} aria-label={label} onClick={onClick} className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900">{children}</button>
)

const MenuItem = ({ title, text, onClick }: { title: string; text: string; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="block w-full rounded-lg px-3 py-1.5 text-left hover:bg-slate-50">
    <span className="block font-medium text-slate-800">{title}</span>
    <span className="block text-[11px] text-slate-500">{text}</span>
  </button>
)

// ---------- Preview ----------

// WhatsApp formatting: *bold* _italic_ ~strike~ ```mono```
function formatted(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /```([\s\S]+?)```|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const k = out.length
    if (m[1] !== undefined) out.push(<code key={k} className="font-mono text-[12px]">{m[1]}</code>)
    else if (m[2] !== undefined) out.push(<b key={k}>{m[2]}</b>)
    else if (m[3] !== undefined) out.push(<i key={k}>{m[3]}</i>)
    else out.push(<s key={k}>{m[4]}</s>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function Preview({ d }: { d: TemplateDraft }) {
  const fill = (text: string, examples: string[]) => text.replace(/\{\{(\d+)\}\}/g, (m, n) => examples[Number(n) - 1]?.trim() || m)
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-slate-500">Template preview</p>
      {/* Phone: bezel, screen, dynamic island */}
      <div className="mx-auto w-[300px] rounded-[48px] bg-slate-900 p-[10px] shadow-xl ring-1 ring-slate-700">
        <div className="relative flex h-[600px] flex-col overflow-hidden rounded-[38px] bg-[#efeae2]">
          <span aria-hidden className="absolute left-1/2 top-2 z-10 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black" />

          {/* Status bar + WhatsApp chat header */}
          <div className="bg-[#008069] text-white">
            <div className="flex h-11 items-center justify-between px-7 pt-1 text-[12px] font-semibold">
              <span>9:41</span>
              <span className="flex items-center gap-1"><Signal size={12} /><Wifi size={12} /><BatteryFull size={16} /></span>
            </div>
            <div className="flex items-center gap-2 px-2 pb-2.5 pt-0.5">
              <ArrowLeft size={18} />
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[13px] font-bold text-[#008069]">S</span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="flex items-center gap-1 truncate text-[14px] font-semibold">Selfera <BadgeCheck size={13} className="fill-[#25d366] text-[#008069]" /></p>
                <p className="truncate text-[11px] text-white/80">Business account</p>
              </div>
              <Video size={18} /><Phone size={16} className="mx-1" /><MoreVertical size={18} />
            </div>
          </div>

          {/* Chat */}
          <div className="flex-1 space-y-2 overflow-y-auto px-2.5 py-3" style={{ backgroundImage: 'radial-gradient(rgba(0,0,0,0.045) 1px, transparent 1px)', backgroundSize: '12px 12px' }}>
            <p className="mx-auto w-fit rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-medium text-slate-500 shadow-sm">Today</p>
            <p className="mx-auto max-w-[90%] rounded-md bg-[#fff5c4] px-2 py-1 text-center text-[10px] leading-snug text-slate-600 shadow-sm">
              This business uses a secure service from Meta to manage this chat. Tap to learn more.
            </p>
            <div className="relative max-w-[88%] rounded-lg rounded-tl-none bg-white text-[13px] leading-snug text-[#111b21] shadow-sm">
              <span aria-hidden className="absolute -left-[7px] top-0 h-0 w-0 border-r-[8px] border-t-[8px] border-r-white border-t-transparent" />
              <div className="px-2 pb-1 pt-1.5">
                {d.header && <p className="mb-1 font-bold">{fill(d.header, [d.headerExample || ''])}</p>}
                <p className="whitespace-pre-wrap break-words">{d.body ? formatted(fill(d.body, d.bodyExamples)) : <span className="text-slate-400">Your message appears here</span>}</p>
                {d.footer && <p className="mt-1 text-[11px] text-[#667781]">{d.footer}</p>}
                <p className="-mb-0.5 mt-0.5 text-right text-[10px] text-[#667781]">9:41</p>
              </div>
              {d.buttons.map((b, i) => (
                <div key={i} className="flex items-center justify-center gap-1.5 border-t border-slate-100 py-2 text-[13px] font-medium text-[#00a5f4]">
                  {b.type === 'URL' ? <ExternalLink size={13} /> : b.type === 'PHONE_NUMBER' ? <Phone size={13} /> : <Reply size={13} />}
                  {b.text || 'Button'}
                </div>
              ))}
            </div>
          </div>

          {/* Message bar + home indicator */}
          <div className="flex items-center gap-1.5 px-2 pb-2 pt-1">
            <div className="flex h-10 flex-1 items-center gap-2 rounded-full bg-white px-3 text-[#8696a0] shadow-sm">
              <Smile size={18} /><span className="flex-1 text-[14px]">Message</span><Paperclip size={17} /><Camera size={17} />
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00a884] text-white"><Mic size={18} /></span>
          </div>
          <span aria-hidden className="mx-auto mb-2 h-1 w-28 rounded-full bg-black/80" />
        </div>
      </div>
    </div>
  )
}
