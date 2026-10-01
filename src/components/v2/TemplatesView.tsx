'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Plus, Pencil } from 'lucide-react'
import { STEPS, PLATFORMS, SERVICES, MESSAGING, platformLabel, serviceOf, type TemplateRow } from '@/lib/templates'
import { PLACEHOLDERS } from '@/lib/placeholders'
import { saveTemplate, setTemplateActive } from '@/app/dashboard/actions'
import { PlatformIcon, Modal, useAction, ErrorNote, Spinner } from '@/components/ui'

const hasSubject = (platform: string) => platform === 'Email' || platform === 'All'
const slug = (s: string) => encodeURIComponent(s)

// ---------- Level 1 and 2: services, then platforms ----------
export function TemplatesHome({ templates, selected }: { templates: TemplateRow[]; selected: string | null }) {
  const router = useRouter()
  const count = (service: string, platform?: string) =>
    templates.filter(t => serviceOf(t) === service && (!platform || t.platform === platform)).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Templates</h1>
        <p className="text-sm text-muted">Pick a service, then a platform.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map(s => (
          <button
            key={s}
            onClick={() => router.replace(selected === s ? '/dashboard/templates' : `/dashboard/templates?service=${slug(s)}`, { scroll: false })}
            className={`card card-link flex items-center justify-between !p-4 text-left ${selected === s ? '!border-primary ring-1 ring-primary' : ''}`}
          >
            <div>
              <h3 className="font-semibold">{s === 'General' ? 'General (any service)' : s}</h3>
              <p className="text-xs text-muted">{count(s)} templates</p>
            </div>
            <ChevronRight size={16} className={`text-slate-400 transition-transform ${selected === s ? 'rotate-90' : ''}`} />
          </button>
        ))}
      </div>

      {selected && (
        <section className="space-y-3">
          <h2 className="font-semibold">{selected === 'General' ? 'General' : selected}: platforms</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {PLATFORMS.map(p => (
              <Link key={p} href={`/dashboard/templates/${slug(selected)}/${slug(p)}`} className="card card-link flex items-center gap-3 !p-4">
                <PlatformIcon platform={p} size={18} className="shrink-0" />
                <div className="min-w-0">
                  <div className="truncate font-medium">{platformLabel(p)}</div>
                  <div className="text-xs text-muted">{count(selected, p)} of {STEPS.length}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ---------- Level 3: the messages for one service + platform ----------
// Which template is used for this slot, most specific first (same rule as the database)
function chain(service: string, platform: string): [string, string][] {
  const out: [string, string][] = []
  const services = service === 'General' ? ['General'] : [service, 'General']
  for (const s of services) {
    if (platform !== 'All') out.push([s, platform])
    if (platform === 'All' || MESSAGING.includes(platform)) out.push([s, 'All'])
  }
  return out
}

export function TemplateSlots({ templates, service, platform, isAdmin }: { templates: TemplateRow[]; service: string; platform: string; isAdmin: boolean }) {
  const [editing, setEditing] = useState<Editing | null>(null)
  const toggle = useAction()
  const find = (step: string, s: string, p: string) => templates.find(t => t.step === step && serviceOf(t) === s && t.platform === p)

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <PlatformIcon platform={platform} size={20} />
        <h1 className="text-2xl font-semibold">{service === 'General' ? 'General' : service} · {platformLabel(platform)}</h1>
      </div>
      {platform === 'All' && <p className="text-sm text-muted">Used for WhatsApp, Instagram, Facebook and Email when there is no platform-specific template.</p>}
      <ErrorNote error={toggle.error} />

      {STEPS.map(step => {
        const own = find(step, service, platform)
        const fallback = chain(service, platform)
          .filter(([s, p]) => !(s === service && p === platform))
          .map(([s, p]) => find(step, s, p))
          .find(t => t?.is_active)
        const usedNote = !own || !own.is_active
          ? fallback ? `${own ? 'Off, so it uses' : 'Not set, uses'} ${serviceOf(fallback)} · ${platformLabel(fallback.platform)}` : `${own ? 'Off' : 'Not set'}, and nothing to fall back on. Drafts for this step will be empty.`
          : null

        return (
          <div key={step} className={`card space-y-2 !p-4 ${own && !own.is_active ? 'opacity-70' : ''}`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{step}</h2>
              <div className="flex items-center gap-2">
                {own && isAdmin && (
                  <>
                    <Switch on={own.is_active} disabled={toggle.pending} onChange={v => toggle.run(() => setTemplateActive(own.id, v))} />
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ id: own.id, step, service, platform, subject: own.subject || '', body: own.body })}>
                      <Pencil size={14} /> Edit
                    </button>
                  </>
                )}
                {!own && isAdmin && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditing({ id: null, step, service, platform, subject: '', body: '' })}>
                    <Plus size={14} /> Add
                  </button>
                )}
              </div>
            </div>
            {own && (
              <div className="space-y-1 text-sm">
                {own.subject && hasSubject(platform) && <p><span className="text-muted">Subject: </span>{own.subject}</p>}
                <p className="whitespace-pre-wrap text-slate-700">{own.body}</p>
              </div>
            )}
            {usedNote && <p className="text-xs text-muted">{usedNote}</p>}
          </div>
        )
      })}

      {editing && <EditTemplate value={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

// ---------- Edit / add ----------
type Editing = { id: string | null; step: string; service: string; platform: string; subject: string; body: string }

function EditTemplate({ value, onClose }: { value: Editing; onClose: () => void }) {
  const [v, setV] = useState(value)
  const area = useRef<HTMLTextAreaElement>(null)
  const { run, pending, error } = useAction()

  const insert = (ph: string) => {
    const el = area.current
    const start = el?.selectionStart ?? v.body.length
    const end = el?.selectionEnd ?? v.body.length
    setV({ ...v, body: v.body.slice(0, start) + ph + v.body.slice(end) })
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + ph.length, start + ph.length) })
  }

  return (
    <Modal title={`${v.id ? 'Edit' : 'Add'} · ${v.step}`} open onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={e => {
          e.preventDefault()
          run(() => saveTemplate({ ...v, service: v.service === 'General' ? '' : v.service }), onClose)
        }}
      >
        {hasSubject(v.platform) && (
          <input
            className="input"
            placeholder={v.platform === 'All' ? 'Subject (used for email only)' : 'Subject'}
            value={v.subject}
            onChange={e => setV({ ...v, subject: e.target.value })}
          />
        )}
        <textarea ref={area} className="input min-h-48" placeholder="Message" value={v.body} onChange={e => setV({ ...v, body: e.target.value })} autoFocus />
        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.map(ph => (
            <button key={ph} type="button" className="chip !py-0.5 !text-xs" onClick={() => insert(ph)}>{ph}</button>
          ))}
        </div>
        <ErrorNote error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>{pending && <Spinner size={14} />} Save</button>
        </div>
      </form>
    </Modal>
  )
}

function Switch({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={on ? 'On' : 'Off'} disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${on ? 'bg-primary' : 'bg-slate-300'} disabled:opacity-50`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}
