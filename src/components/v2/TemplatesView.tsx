'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronRight,
  Plus,
  Pencil,
  Globe,
  Hotel,
  Utensils,
  Beer,
  Building2,
  Briefcase,
  Store,
  Scissors,
  Dumbbell,
  Coffee,
  Sparkles,
  RotateCcw,
} from 'lucide-react'
import { MetaStatusBadge, MetaTemplateSection, type MetaTemplateRow } from '@/components/whatsapp/MetaTemplateSection'
import {
  STEPS,
  PLATFORMS,
  MESSAGING,
  platformLabel,
  businessTypeOf,
  DEFAULT_TEMPLATE_CATEGORIES,
  type TemplateRow,
  type TemplateCategory,
} from '@/lib/templates'
import { PLACEHOLDERS } from '@/lib/placeholders'
import {
  saveTemplate,
  setTemplateActive,
  revertTemplate,
  createBusinessCategory,
} from '@/app/dashboard/actions'
import { PlatformIcon, Modal, useAction, ErrorNote, Spinner } from '@/components/ui'

const hasSubject = (platform: string) => platform === 'Email' || platform === 'All'
const slug = (s: string) => encodeURIComponent(s)

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Globe,
  Hotel,
  Utensils,
  Beer,
  Building2,
  Briefcase,
  Store,
  Scissors,
  Dumbbell,
  Coffee,
  Sparkles,
}

function CategoryIconDisplay({
  iconName,
  size = 20,
  className,
}: {
  iconName?: string | null
  size?: number
  className?: string
}) {
  const Icon = (iconName && ICONS[iconName]) || Building2
  return <Icon size={size} className={className} />
}

const STEP_SUBTITLES: Record<string, string> = {
  'First contact': 'Initial outreach · Step 1',
  'Follow-up 1': 'Follow-up 1 · Step 2 (3 days)',
  'Follow-up 2': 'Follow-up 2 · Step 3 (5 days)',
  'Final check': 'Final check-in · Step 4 (14 days)',
  Reply: 'Inbound response · When client replies',
  Upsell: 'Expansion · For won clients',
}

// ---------- Level 1 and 2: Business types, then which medium ----------
export function TemplatesHome({
  templates,
  selected,
  categories = DEFAULT_TEMPLATE_CATEGORIES,
  connectedPlatforms = [],
  isAdmin = false,
}: {
  templates: TemplateRow[]
  selected: string | null
  categories?: TemplateCategory[]
  connectedPlatforms?: string[]
  isAdmin?: boolean
}) {
  const router = useRouter()
  const [showAddCategory, setShowAddCategory] = useState(false)

  const count = (bType: string, platform?: string) =>
    templates.filter(
      t => businessTypeOf(t) === bType && (!platform || t.platform === platform)
    ).length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Templates</h1>
        <p className="text-sm text-slate-500">
          Pick a business category, choose an outreach medium, and customize your messaging sequence.
        </p>
      </div>

      {/* Level 1: Business Types / Categories */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">1. Business categories</h2>
          <span className="text-xs text-slate-500">
            {categories.length} {categories.length === 1 ? 'category' : 'categories'} available
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {categories.map(c => {
            const isSelected = selected === c.key
            const n = count(c.key)
            const isGeneral = c.key === 'General'

            return (
              <button
                type="button"
                key={c.key}
                onClick={() =>
                  router.replace(
                    isSelected
                      ? '/dashboard/templates'
                      : `/dashboard/templates?type=${slug(c.key)}`,
                    { scroll: false }
                  )
                }
                className={`card card-link flex items-center justify-between !p-4 text-left transition-all ${
                  isSelected ? '!border-primary ring-2 ring-primary/20 bg-primary/5' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      isSelected
                        ? 'bg-primary text-white'
                        : isGeneral
                        ? 'bg-primary/10 text-primary'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <CategoryIconDisplay iconName={c.iconName} size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-slate-900">{c.label}</h3>
                    <p className="text-xs text-slate-500 truncate">
                      {isGeneral
                        ? `${n} templates (Baseline)`
                        : n > 0
                        ? `${n} customized template${n === 1 ? '' : 's'}`
                        : 'Inherits General baseline'}
                    </p>
                  </div>
                </div>
                <ChevronRight
                  size={18}
                  className={`text-slate-400 shrink-0 transition-transform ${
                    isSelected ? 'rotate-90 text-primary' : ''
                  }`}
                />
              </button>
            )
          })}

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowAddCategory(true)}
              className="card border-dashed hover:border-primary hover:text-primary flex items-center justify-center gap-2 !p-4 text-slate-500 transition-all group"
            >
              <Plus size={18} className="group-hover:scale-110 transition-transform" />
              <span className="font-semibold text-sm">Add Category</span>
            </button>
          )}
        </div>
      </div>

      {/* Level 2: Which medium */}
      {selected && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                2. Which medium for {selected === 'General' ? 'General' : selected}?
              </h2>
              <p className="text-xs text-slate-500">
                Choose a communication channel to view and edit its outreach messages.
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {selected}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {PLATFORMS.map(p => {
              const readyCount = count(selected, p)

              return (
                <Link
                  key={p}
                  href={`/dashboard/templates/${slug(selected)}/${slug(p)}`}
                  className="card card-link flex items-center justify-between gap-3 !p-4 transition-all hover:border-primary group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 group-hover:border-slate-300 transition-colors">
                      <PlatformIcon platform={p} size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900 group-hover:text-primary transition-colors">
                        {platformLabel(p)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {readyCount} of {STEPS.length} ready
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-slate-400 shrink-0 group-hover:text-primary transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {showAddCategory && <AddCategoryModal onClose={() => setShowAddCategory(false)} />}
    </div>
  )
}

// ---------- Level 3: What is the outreach (slots for business type + medium) ----------
function chain(businessType: string, platform: string): [string, string][] {
  const out: [string, string][] = []
  const types = businessType === 'General' ? ['General'] : [businessType, 'General']
  for (const b of types) {
    if (platform !== 'All') out.push([b, platform])
    if (platform === 'All' || MESSAGING.includes(platform)) out.push([b, 'All'])
  }
  return out
}

export function TemplateSlots({
  templates,
  businessType,
  platform,
  isAdmin,
  connectedPlatforms = [],
  metaTemplates = [],
}: {
  templates: TemplateRow[]
  businessType: string
  platform: string
  isAdmin: boolean
  connectedPlatforms?: string[]
  metaTemplates?: MetaTemplateRow[]
}) {
  const [editing, setEditing] = useState<Editing | null>(null)
  const toggle = useAction()

  const find = (step: string, bType: string, p: string) =>
    templates.find(
      t => t.step === step && businessTypeOf(t) === bType && t.platform === p
    )

  return (
    <div className="w-full max-w-5xl space-y-5">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
              <PlatformIcon platform={platform} size={22} />
            </div>
            <div>
              <h1 className="!mb-0 text-2xl font-bold tracking-tight text-slate-900">
                {businessType === 'General' ? 'General' : businessType} · {platformLabel(platform)}
              </h1>
              <p className="text-xs text-slate-500">
                {platform === 'All'
                  ? 'Used across WhatsApp, Instagram, Facebook, and Email when no platform-specific template is set.'
                  : `Direct outreach messages for ${platform}.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <ErrorNote error={toggle.error} />

      {/* Outreach sequence */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">3. Outreach sequence</h2>
          <span className="text-xs text-slate-400">Step-by-step cadence</span>
        </div>

        {STEPS.map(step => {
          const own = find(step, businessType, platform)
          const fallback = chain(businessType, platform)
            .filter(([b, p]) => !(b === businessType && p === platform))
            .map(([b, p]) => find(step, b, p))
            .find(t => t?.is_active)

          const isCustomized = own && businessTypeOf(own) !== 'General'
          const isGeneralBaseline = own && businessTypeOf(own) === 'General'

          const usedNote =
            !own || !own.is_active
              ? fallback
                ? `${
                    own ? 'Inactive, so outreach uses' : 'Not customized for this category, uses'
                  } ${businessTypeOf(fallback)} · ${platformLabel(fallback.platform)}`
                : `${
                    own ? 'Inactive' : 'Not set'
                  }, and no fallback template is available. Drafts for this step will be empty.`
              : null

          return (
            <div
              key={step}
              className={`card space-y-3 !p-5 transition-all ${
                own && !own.is_active ? 'opacity-70 bg-slate-50' : ''
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900">{step}</h3>
                      {isCustomized ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          Customized
                        </span>
                      ) : isGeneralBaseline ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          Baseline
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          Inherited
                        </span>
                      )}
                      {platform === 'WhatsApp' && (own?.whatsapp_template_name || (!own && fallback?.whatsapp_template_name)) && (
                        <span
                          className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 truncate max-w-[220px]"
                          title={`Meta Template: ${own?.whatsapp_template_name || fallback?.whatsapp_template_name}`}
                        >
                          Meta: {own?.whatsapp_template_name || fallback?.whatsapp_template_name}
                        </span>
                      )}
                      {platform === 'WhatsApp' && (() => {
                        const name = own?.whatsapp_template_name || (!own && fallback?.whatsapp_template_name)
                        if (!name) return null
                        const meta = metaTemplates.find(m => m.name === name && m.status === 'APPROVED') ?? metaTemplates.find(m => m.name === name)
                        return meta ? <MetaStatusBadge status={meta.status} /> : <span className="badge !border-red-200 !bg-red-50 !text-red-700">Not in this product</span>
                      })()}
                    </div>
                    <p className="text-xs text-slate-500">{STEP_SUBTITLES[step] || step}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {own && isAdmin && (
                    <>
                      <Switch
                        on={own.is_active}
                        disabled={toggle.pending}
                        onChange={v =>
                          toggle.run(
                            () => setTemplateActive(own.id, v),
                            undefined,
                            { success: v ? 'Template turned on.' : 'Template turned off.' }
                          )
                        }
                      />
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setEditing({
                            id: own.id,
                            step,
                            businessType,
                            platform,
                            subject: own.subject || '',
                            body: own.body,
                            whatsapp_template_name: own.whatsapp_template_name || null,
                          })
                        }
                      >
                        <Pencil size={14} /> Edit
                      </button>
                      {isCustomized && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          title="Revert to General baseline"
                          disabled={toggle.pending}
                          onClick={() => {
                            if (
                              confirm(
                                `Revert "${step}" for ${businessType} back to the General baseline template?`
                              )
                            ) {
                              toggle.run(
                                () => revertTemplate(own.id),
                                undefined,
                                { success: 'Reverted to General template.' }
                              )
                            }
                          }}
                        >
                          <RotateCcw size={14} /> Revert
                        </button>
                      )}
                    </>
                  )}
                  {!own && isAdmin && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        setEditing({
                          id: null,
                          step,
                          businessType,
                          platform,
                          subject: fallback?.subject || '',
                          body: fallback?.body || '',
                          whatsapp_template_name: fallback?.whatsapp_template_name || null,
                        })
                      }
                    >
                      <Plus size={14} /> Customize
                    </button>
                  )}
                </div>
              </div>

              {own ? (
                <div className="space-y-2 text-sm">
                  {own.subject && hasSubject(platform) && (
                    <p className="font-medium text-slate-800">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                        Subject:{' '}
                      </span>
                      {own.subject}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap text-slate-700 leading-relaxed font-normal bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                    {own.body}
                  </p>
                </div>
              ) : fallback ? (
                <div className="space-y-1.5 text-sm text-slate-500">
                  <p className="italic text-xs text-slate-500">{usedNote}</p>
                  <p className="whitespace-pre-wrap text-slate-600 line-clamp-3 bg-slate-50/50 p-2.5 rounded-lg border border-dashed border-slate-200 text-xs">
                    {fallback.body}
                  </p>
                </div>
              ) : (
                usedNote && <p className="text-xs text-amber-700 font-medium">{usedNote}</p>
              )}
            </div>
          )
        })}
      </div>

      {editing && (
        <EditTemplate
          value={editing}
          metaTemplates={metaTemplates}
          isAdmin={isAdmin}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

// ---------- Edit / add template modal ----------
type Editing = {
  id: string | null
  step: string
  businessType: string
  platform: string
  subject: string
  body: string
  whatsapp_template_name?: string | null
}

function EditTemplate({
  value,
  metaTemplates = [],
  isAdmin,
  onClose,
}: {
  value: Editing
  metaTemplates?: MetaTemplateRow[]
  isAdmin: boolean
  onClose: () => void
}) {
  const [v, setV] = useState(value)
  // A Meta template dialog is open on top: Esc and clicks outside close that one only
  const [metaOpen, setMetaOpen] = useState(false)
  const [formErrors, setFormErrors] = useState<{ subject?: string; body?: string }>({})
  const area = useRef<HTMLTextAreaElement>(null)
  const { run, pending, error } = useAction()

  const insert = (ph: string) => {
    const el = area.current
    const start = el?.selectionStart ?? v.body.length
    const end = el?.selectionEnd ?? v.body.length
    setV({ ...v, body: v.body.slice(0, start) + ph + v.body.slice(end) })
    if (formErrors.body) setFormErrors(prev => ({ ...prev, body: undefined }))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + ph.length, start + ph.length)
    })
  }

  const validate = () => {
    const errs: { subject?: string; body?: string } = {}
    if (hasSubject(v.platform) && !v.subject?.trim()) {
      errs.subject = 'Email subject is required.'
    }
    if (!v.body?.trim()) {
      errs.body = 'Message body is required.'
    }
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  return (
    <Modal
      title={`${v.id ? 'Edit template' : 'Customize template'} · ${v.step}`}
      open
      onClose={onClose}
      locked={pending || metaOpen}
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={e => {
          e.preventDefault()
          if (!validate()) return
          run(
            () =>
              saveTemplate({
                id: v.id,
                step: v.step,
                businessType: v.businessType,
                platform: v.platform,
                subject: v.subject,
                body: v.body,
                whatsapp_template_name: v.whatsapp_template_name || null,
              }),
            onClose,
            { success: 'Template saved.' }
          )
        }}
      >
        <div className="text-xs font-semibold text-slate-500">
          Target: {v.businessType} · {platformLabel(v.platform)}
        </div>
        <ErrorNote error={error} />

        {hasSubject(v.platform) && (
          <div>
            <label className="label">
              Email Subject <span className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</span>
            </label>
            <input
              className={`input w-full ${formErrors.subject ? '!border-rose-400' : ''}`}
              value={v.subject}
              onChange={e => {
                setV({ ...v, subject: e.target.value })
                if (formErrors.subject) setFormErrors(prev => ({ ...prev, subject: undefined }))
              }}
              placeholder="e.g. Quick question for {business_name}"
            />
            {formErrors.subject && (
              <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.subject}</p>
            )}
          </div>
        )}

        <div>
          <label className="label">
            Message Body <span className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</span>
          </label>
          <textarea
            ref={area}
            rows={8}
            className={`input w-full font-mono text-sm leading-relaxed ${
              formErrors.body ? '!border-rose-400' : ''
            }`}
            value={v.body}
            onChange={e => {
              setV({ ...v, body: e.target.value })
              if (formErrors.body) setFormErrors(prev => ({ ...prev, body: undefined }))
            }}
            placeholder="Write your outreach message here…"
          />
          {formErrors.body && (
            <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.body}</p>
          )}
        </div>

        {v.platform === 'WhatsApp' && (
          <MetaTemplateSection
            value={v.whatsapp_template_name || null}
            onChange={name => setV(prev => ({ ...prev, whatsapp_template_name: name }))}
            templates={metaTemplates}
            message={v.body}
            label={`${v.businessType} ${v.step}`}
            isAdmin={isAdmin}
            onSubOpen={setMetaOpen}
          />
        )}

        <div>
          <span className="mb-1 block text-xs font-semibold text-slate-500">
            Insert placeholder:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PLACEHOLDERS.map(ph => (
              <button
                type="button"
                key={ph}
                onClick={() => insert(ph)}
                className="chip hover:border-primary text-xs"
              >
                {ph}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending || !v.body.trim()}>
            {pending && <Spinner />} Save template
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ---------- Add category modal ----------
function AddCategoryModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [iconName, setIconName] = useState('Building2')
  const { run, pending, error } = useAction()
  const router = useRouter()

  const AVAILABLE_ICONS = [
    { name: 'Building2', label: 'Building' },
    { name: 'Briefcase', label: 'Office' },
    { name: 'Store', label: 'Store' },
    { name: 'Utensils', label: 'Dining' },
    { name: 'Hotel', label: 'Hotel' },
    { name: 'Beer', label: 'Pub/Bar' },
    { name: 'Coffee', label: 'Cafe' },
    { name: 'Dumbbell', label: 'Fitness' },
    { name: 'Scissors', label: 'Salon' },
    { name: 'Sparkles', label: 'Services' },
  ]

  return (
    <Modal title="Add business category" open onClose={onClose} locked={pending}>
      <form
        className="space-y-4"
        onSubmit={e => {
          e.preventDefault()
          if (!name.trim()) return
          run(
            () => createBusinessCategory({ name, description, icon_name: iconName }),
            () => {
              onClose()
              router.refresh()
            },
            { success: `Category "${name}" created.` }
          )
        }}
      >
        <ErrorNote error={error} />
        <div>
          <label className="label">
            Category Name <span className="text-rose-500 font-bold ml-0.5">*</span>
          </label>
          <input
            className="input w-full"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Dental Clinics, Gyms & Fitness, Real Estate"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="label">Description (optional)</label>
          <input
            className="input w-full"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Dental and orthodontic clinics"
          />
        </div>

        <div>
          <label className="label">Category Icon</label>
          <div className="grid grid-cols-5 gap-2">
            {AVAILABLE_ICONS.map(i => {
              const isSel = iconName === i.name
              return (
                <button
                  type="button"
                  key={i.name}
                  onClick={() => setIconName(i.name)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                    isSel
                      ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <CategoryIconDisplay iconName={i.name} size={18} />
                  <span className="truncate w-full text-center text-[10px]">{i.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending || !name.trim()}>
            {pending && <Spinner />} Create Category
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Switch({
  on,
  disabled,
  onChange,
}: {
  on: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
        on ? 'bg-primary' : 'bg-slate-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          on ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
