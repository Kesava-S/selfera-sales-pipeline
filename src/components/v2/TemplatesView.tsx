'use client'

import { useRef, useState } from 'react'
import { Plus, FileText } from 'lucide-react'
import { CONFIG } from '@/lib/config'
import { PLACEHOLDERS } from '@/lib/placeholders'
import { saveTemplate, setTemplateActive } from '@/app/dashboard/actions'
import { PlatformIcon, Modal, useAction, ErrorNote, EmptyState, Spinner } from '@/components/ui'

export type TemplateRow = {
  id: string; name: string; platform: string; step: string; services: string[]
  subject: string | null; body: string; is_active: boolean
}

const STEPS = ['First contact', 'Follow-up 1', 'Follow-up 2', 'Final check', 'Reply', 'Upsell']
const PLATFORMS = ['All', 'WhatsApp', 'Instagram', 'Facebook', 'Email', 'Phone', 'Walk-in']
const platformLabel = (p: string) => (p === 'All' ? 'All platforms' : p)
const serviceOf = (t: TemplateRow) => t.services?.[0] || ''
const hasSubject = (platform: string) => platform === 'Email' || platform === 'All'

type Editing = { id: string | null; step: string; service: string; platform: string; subject: string; body: string }

export function TemplatesView({ templates, loadError, isAdmin }: { templates: TemplateRow[]; loadError: string | null; isAdmin: boolean }) {
  const [step, setStep] = useState(STEPS[0])
  const [service, setService] = useState('any')
  const [platform, setPlatform] = useState('any')
  const [editing, setEditing] = useState<Editing | null>(null)
  const [viewing, setViewing] = useState<TemplateRow | null>(null)
  const toggle = useAction()

  const rows = templates
    .filter(t => t.step === step)
    .filter(t => service === 'any' || serviceOf(t) === service)
    .filter(t => platform === 'any' || t.platform === platform)
    .sort((a, z) => (serviceOf(a) || 'General').localeCompare(serviceOf(z) || 'General') || PLATFORMS.indexOf(a.platform) - PLATFORMS.indexOf(z.platform))

  const open = (t: TemplateRow) =>
    isAdmin
      ? setEditing({ id: t.id, step: t.step, service: serviceOf(t), platform: t.platform, subject: t.subject || '', body: t.body })
      : setViewing(t)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Templates</h1>
        {isAdmin && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setEditing({
              id: null, step,
              service: service === 'any' ? '' : service,
              platform: platform === 'any' ? 'All' : platform,
              subject: '', body: '',
            })}
          >
            <Plus size={16} /> New template
          </button>
        )}
      </div>

      {/* Message type */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {STEPS.map(s => (
          <button
            key={s}
            onClick={() => setStep(s)}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-semibold ${step === s ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select className="input !w-auto" value={service} onChange={e => setService(e.target.value)} aria-label="Service">
          <option value="any">Any service</option>
          <option value="">General</option>
          {CONFIG.SERVICES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="input !w-auto" value={platform} onChange={e => setPlatform(e.target.value)} aria-label="Platform">
          <option value="any">Any platform</option>
          {PLATFORMS.map(p => <option key={p} value={p}>{platformLabel(p)}</option>)}
        </select>
      </div>

      <ErrorNote error={loadError || toggle.error} />

      {rows.length === 0 ? (
        <EmptyState icon={<FileText size={28} />} title="No templates here" text={isAdmin ? 'Use New template to add one.' : undefined} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <tbody>
              {rows.map(t => (
                <tr key={t.id} className="cursor-pointer" onClick={() => open(t)}>
                  <td>
                    <span className={`flex items-center gap-2 ${t.is_active ? '' : 'text-slate-400'}`}>
                      <PlatformIcon platform={t.platform} size={15} className="shrink-0" />
                      {serviceOf(t) || 'General'} · {platformLabel(t.platform)}
                    </span>
                  </td>
                  <td className="w-24 text-right" onClick={e => e.stopPropagation()}>
                    {isAdmin ? (
                      <Switch on={t.is_active} disabled={toggle.pending} onChange={v => toggle.run(() => setTemplateActive(t.id, v))} />
                    ) : (
                      <span className="text-xs text-muted">{t.is_active ? 'On' : 'Off'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <EditTemplate value={editing} onClose={() => setEditing(null)} />}

      <Modal title={viewing ? `${serviceOf(viewing) || 'General'} · ${platformLabel(viewing.platform)} · ${viewing.step}` : ''} open={!!viewing} onClose={() => setViewing(null)}>
        {viewing && (
          <div className="space-y-3 text-sm">
            {viewing.subject && hasSubject(viewing.platform) && <p><span className="text-muted">Subject: </span>{viewing.subject}</p>}
            <p className="whitespace-pre-wrap">{viewing.body}</p>
          </div>
        )}
      </Modal>
    </div>
  )
}

function EditTemplate({ value, onClose }: { value: Editing; onClose: () => void }) {
  const [v, setV] = useState(value)
  const area = useRef<HTMLTextAreaElement>(null)
  const { run, pending, error } = useAction()
  const isNew = !v.id

  const insert = (ph: string) => {
    const el = area.current
    const start = el?.selectionStart ?? v.body.length
    const end = el?.selectionEnd ?? v.body.length
    setV({ ...v, body: v.body.slice(0, start) + ph + v.body.slice(end) })
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + ph.length, start + ph.length) })
  }

  const title = isNew ? `New template · ${v.step}` : `${v.service || 'General'} · ${platformLabel(v.platform)} · ${v.step}`

  return (
    <Modal title={title} open onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={e => { e.preventDefault(); run(() => saveTemplate(v), onClose) }}
      >
        {isNew && (
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={v.service} onChange={e => setV({ ...v, service: e.target.value })} aria-label="Service">
              <option value="">General</option>
              {CONFIG.SERVICES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="input" value={v.platform} onChange={e => setV({ ...v, platform: e.target.value })} aria-label="Platform">
              {PLATFORMS.map(p => <option key={p} value={p}>{platformLabel(p)}</option>)}
            </select>
          </div>
        )}

        {hasSubject(v.platform) && (
          <input
            className="input"
            placeholder={v.platform === 'All' ? 'Subject (used for email only)' : 'Subject'}
            value={v.subject}
            onChange={e => setV({ ...v, subject: e.target.value })}
          />
        )}

        <textarea
          ref={area}
          className="input min-h-48"
          placeholder="Message"
          value={v.body}
          onChange={e => setV({ ...v, body: e.target.value })}
        />

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
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? 'On' : 'Off'}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${on ? 'bg-primary' : 'bg-slate-300'} disabled:opacity-50`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}
