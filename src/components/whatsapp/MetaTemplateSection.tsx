'use client'

// Meta template for a WhatsApp outreach template (Templates → WhatsApp). WhatsApp only
// allows an approved Meta template when the lead hasn't messaged in the last 24 hours.
// Only this product's templates are listed; the Meta account is shared with other products.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Clock, Link2Off, Pencil, Plus, RefreshCw, Trash2, XCircle } from 'lucide-react'
import {
  addMetaTemplate, listAddableMetaTemplates, removeMetaTemplate, setMetaVariableMap,
  syncMetaTemplates, unlinkMetaTemplate,
} from '@/app/dashboard/templates/metaActions'
import {
  draftFromMessage, variablesIn, VAR_KEYS, VAR_LABELS,
  type MetaCategory, type MetaComponent, type TemplateDraft, type VarKey, type VariableMap,
} from '@/lib/metaTemplateDraft'
import { ErrorNote, Modal, Spinner, useAction } from '@/components/ui'
import { LANGUAGES, MetaTemplateEditor as TemplateEditor } from '@/components/whatsapp/MetaTemplateEditor'

export type MetaTemplateRow = {
  id: string; meta_id: string | null; name: string; language: string; category: MetaCategory; status: string
  components: MetaComponent[]; rejected_reason: string | null; quality_score: string | null
  variable_map: VariableMap | null; last_synced_at: string | null
}

const STATUS: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  APPROVED: { label: 'Approved', cls: '!border-emerald-200 !bg-emerald-50 !text-emerald-700', icon: <CheckCircle2 size={12} /> },
  PENDING: { label: 'In review', cls: '!border-amber-200 !bg-amber-50 !text-amber-700', icon: <Clock size={12} /> },
  IN_APPEAL: { label: 'In appeal', cls: '!border-amber-200 !bg-amber-50 !text-amber-700', icon: <Clock size={12} /> },
  REJECTED: { label: 'Rejected', cls: '!border-red-200 !bg-red-50 !text-red-700', icon: <XCircle size={12} /> },
  PAUSED: { label: 'Paused', cls: '!border-orange-200 !bg-orange-50 !text-orange-700', icon: <AlertTriangle size={12} /> },
  DISABLED: { label: 'Disabled', cls: '!border-red-200 !bg-red-50 !text-red-700', icon: <XCircle size={12} /> },
  DELETED: { label: 'Deleted in Meta', cls: '!border-red-200 !bg-red-50 !text-red-700', icon: <XCircle size={12} /> },
}
export const metaStatusOf = (s: string) => STATUS[s] ?? { label: s.charAt(0) + s.slice(1).toLowerCase(), cls: '', icon: null }

export function MetaStatusBadge({ status }: { status: string }) {
  const st = metaStatusOf(status)
  return <span className={`badge ${st.cls}`}>{st.icon}{st.label}</span>
}

const bodyOf = (t: { components: MetaComponent[] }) => (t.components.find(c => c.type === 'BODY') as { text?: string } | undefined)?.text ?? ''

type Sub = { kind: 'editor'; row: MetaTemplateRow | null; draft?: TemplateDraft; map?: VariableMap } | { kind: 'add' } | { kind: 'delete'; row: MetaTemplateRow } | null

// The "Meta template" part of the outreach template editor. Its dialogs open on top
// (in a portal); `onSubOpen` tells the outer editor to ignore Esc meanwhile.
export function MetaTemplateSection({ value, onChange, templates, message, label, isAdmin, onSubOpen }: {
  value: string | null
  onChange: (name: string | null) => void
  templates: MetaTemplateRow[]
  message: string
  label: string
  isAdmin: boolean
  onSubOpen: (open: boolean) => void
}) {
  const [sub, setSubState] = useState<Sub>(null)
  const setSub = (s: Sub) => { setSubState(s); onSubOpen(!!s) }
  const sync = useAction()
  const map = useAction()
  const unlink = useAction()
  const selected = templates.find(t => t.name === value && t.status === 'APPROVED') ?? templates.find(t => t.name === value) ?? null
  const vars = selected ? variablesIn(bodyOf(selected)) : []
  const currentMap: VariableMap = { body: [], ...(selected?.variable_map || {}) }

  const saveMap = (i: number, key: VarKey) => {
    if (!selected) return
    const body = vars.map((_, j) => (j === i ? key : currentMap.body[j] ?? 'message'))
    map.run(() => setMetaVariableMap(selected.id, { ...currentMap, body }), undefined, { success: 'Saved.' })
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">Meta template <span className="font-normal text-slate-500">(outside the 24-hour window)</span></p>
          <p className="text-[11px] text-slate-500">WhatsApp only delivers an approved template when the lead hasn&apos;t messaged in the last 24 hours.</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" disabled={sync.pending}
          onClick={() => sync.run(() => syncMetaTemplates(), undefined, { success: d => `Synced ${d?.count ?? 0} template${d?.count === 1 ? '' : 's'} from Meta${d?.missing ? `, ${d.missing} deleted there` : ''}.` })}>
          {sync.pending ? <Spinner size={14} /> : <RefreshCw size={14} />} Sync from Meta
        </button>
      </div>

      <select className="input w-full bg-white text-sm" value={value || ''} onChange={e => onChange(e.target.value || null)}>
        <option value="">None (only within 24 hours of their last message)</option>
        {templates.map(t => (
          <option key={t.id} value={t.name}>{t.name} · {metaStatusOf(t.status).label}</option>
        ))}
        {value && !templates.some(t => t.name === value) && <option value={value}>{value} · not in this product</option>}
      </select>

      {value && !selected && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
          &ldquo;{value}&rdquo; isn&apos;t one of this product&apos;s Meta templates, so it can&apos;t be sent. Pick another, add it from Meta, or create one.
        </p>
      )}

      {selected && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <MetaStatusBadge status={selected.status} />
            <span className="text-[11px] text-slate-500">{selected.category.charAt(0) + selected.category.slice(1).toLowerCase()} · {LANGUAGES.find(l => l.code === selected.language)?.label ?? selected.language}</span>
            {isAdmin && (
              <span className="ml-auto flex gap-1">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSub({ kind: 'editor', row: selected })}><Pencil size={13} /> Edit</button>
                <button type="button" className="btn btn-ghost btn-sm" title="Stop using it here; it stays in Meta" disabled={unlink.pending}
                  onClick={() => unlink.run(() => unlinkMetaTemplate(selected.id), () => onChange(null), { success: 'Removed from this product. It is still in Meta.' })}>
                  <Link2Off size={13} />
                </button>
                <button type="button" className="btn btn-ghost btn-sm !text-red-700" title="Delete from Meta" onClick={() => setSub({ kind: 'delete', row: selected })}><Trash2 size={13} /></button>
              </span>
            )}
          </div>
          {selected.status !== 'APPROVED' && (
            <p className="text-[11px] text-amber-800">
              Can&apos;t send until Meta approves it.{selected.rejected_reason ? ` Reason: ${selected.rejected_reason.replace(/_/g, ' ').toLowerCase()}.` : ''}
            </p>
          )}
          <p className="whitespace-pre-wrap rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-700">{bodyOf(selected)}</p>
          {vars.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-600">Filled in for each lead</p>
              {vars.map((v, i) => (
                <div key={v} className="flex items-center gap-2">
                  <span className="w-10 font-mono text-xs text-slate-500">{`{{${v}}}`}</span>
                  <select className="input !py-1 text-xs" disabled={!isAdmin || map.pending} value={currentMap.body[i] ?? 'message'} onChange={e => saveMap(i, e.target.value as VarKey)}>
                    {VAR_KEYS.map(k => <option key={k} value={k}>{VAR_LABELS[k]}</option>)}
                  </select>
                </div>
              ))}
              <ErrorNote error={map.error} />
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary btn-sm" disabled={!message.trim()}
            onClick={() => { const { draft, map } = draftFromMessage(message, label); setSub({ kind: 'editor', row: null, draft, map }) }}>
            <Plus size={14} /> Create from this message
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSub({ kind: 'add' })}>Add existing from Meta</button>
        </div>
      )}
      <ErrorNote error={sync.error || unlink.error} />

      {sub && createPortal(<>
      {sub?.kind === 'editor' && (
        <TemplateEditor row={sub.row} statusLabel={sub.row ? metaStatusOf(sub.row.status).label : undefined} initial={sub.draft} initialMap={sub.map} onClose={() => setSub(null)}
          onCreated={name => { onChange(name); setSub(null) }} />
      )}
      {sub?.kind === 'add' && <AddFromMeta onClose={() => setSub(null)} onAdded={name => { onChange(name); setSub(null) }} />}
      {sub?.kind === 'delete' && <DeleteFromMeta row={sub.row} onClose={() => setSub(null)} onDeleted={() => { onChange(null); setSub(null) }} />}
      </>, document.body)}
    </div>
  )
}

// ---------- Add a template already in the Meta account ----------

function AddFromMeta({ onClose, onAdded }: { onClose: () => void; onAdded: (name: string) => void }) {
  const [list, setList] = useState<{ id: string; name: string; language: string; status: string; category: string; body: string }[] | null>(null)
  const [loadError, setError] = useState<string | null>(null)
  const add = useAction()
  useEffect(() => {
    let live = true
    listAddableMetaTemplates().then(r => {
      if (!live) return
      if (r.ok) setList(r.data ?? [])
      else setError(r.error)
    })
    return () => { live = false }
  }, [])
  return (
    <Modal open onClose={onClose} locked={add.pending} wide title="Add a template from Meta">
      <p className="mb-3 text-sm text-slate-600">
        Your Meta account is shared with other products. Only add templates written for Selfera Sales; once added they can be used, edited and deleted here.
      </p>
      <ErrorNote error={loadError || add.error} />
      {!list && !loadError ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : !list ? null : list.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">Every template in Meta is already added.</p>
      ) : (
        <div className="max-h-[60dvh] space-y-2 overflow-y-auto">
          {list.map(t => (
            <div key={t.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-slate-900">{t.name}</span>
                  <MetaStatusBadge status={t.status} />
                  <span className="text-[11px] text-slate-500">{t.language}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{t.body}</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" disabled={add.pending}
                onClick={() => add.run(() => addMetaTemplate(t.id), d => onAdded(d?.name ?? t.name), { success: `${t.name} added.` })}>
                {add.pending ? <Spinner size={14} /> : <Plus size={14} />} Add
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

function DeleteFromMeta({ row, onClose, onDeleted }: { row: MetaTemplateRow; onClose: () => void; onDeleted: () => void }) {
  const del = useAction()
  return (
    <Modal open onClose={onClose} locked={del.pending} title="Delete this template from Meta?">
      <p className="text-sm text-slate-600">
        <b>{row.name}</b> is deleted from your Meta account, in every language. Meta doesn&apos;t let you reuse the name for 30 days.
        Outreach templates using it can&apos;t be sent outside the 24-hour window until they use another one.
      </p>
      <ErrorNote error={del.error} />
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn btn-secondary" disabled={del.pending} onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" disabled={del.pending} onClick={() => del.run(() => removeMetaTemplate(row.id), onDeleted, { success: 'Template deleted from Meta.' })}>
          {del.pending ? <Spinner /> : <Trash2 size={16} />} Delete
        </button>
      </div>
    </Modal>
  )
}
