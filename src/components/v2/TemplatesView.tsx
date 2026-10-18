'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronRight, Plus, Pencil, ArrowLeft, Globe, Hotel, Utensils, Beer, Building2,
} from 'lucide-react'
import {
  STEPS, PLATFORMS, TEMPLATE_BUSINESS_TYPES, MESSAGING, platformLabel,
  businessTypeOf, type TemplateRow,
} from '@/lib/templates'
import { PLACEHOLDERS } from '@/lib/placeholders'
import { saveTemplate, setTemplateActive } from '@/app/dashboard/actions'
import { PlatformIcon, Modal, useAction, ErrorNote, Spinner } from '@/components/ui'

const hasSubject = (platform: string) => platform === 'Email' || platform === 'All'
const slug = (s: string) => encodeURIComponent(s)

const CATEGORIES = [
  {
    key: 'Restaurants and cafes',
    label: 'Restaurants and cafes',
    desc: 'Restaurants, cafes, bakeries & takeaways',
    icon: Utensils,
  },
  {
    key: 'Hotels',
    label: 'Hotels',
    desc: 'Hotels, B&Bs & guesthouses',
    icon: Hotel,
  },
  {
    key: 'Pubs',
    label: 'Pubs',
    desc: 'Pubs, bars & public houses',
    icon: Beer,
  },
  {
    key: 'Property Management',
    label: 'Property Management',
    desc: 'Short-let hosts & serviced properties',
    icon: Building2,
  },
  {
    key: 'General',
    label: 'General (all business types)',
    desc: 'Default baseline for all business types',
    icon: Globe,
  },
] as const

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
}: {
  templates: TemplateRow[]
  selected: string | null
}) {
  const router = useRouter()
  const count = (bType: string, platform?: string) =>
    templates.filter(t => businessTypeOf(t) === bType && (!platform || t.platform === platform)).length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Templates</h1>
        <p className="text-sm text-slate-500">
          Pick a business type, choose a medium, and customize the outreach sequence.
        </p>
      </div>

      {/* Level 1: Business Types */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-slate-900">1. Business types</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map(c => {
            const Icon = c.icon
            const isSelected = selected === c.key
            const n = count(c.key)
            return (
              <button
                type="button"
                key={c.key}
                onClick={() =>
                  router.replace(
                    isSelected ? '/dashboard/templates' : `/dashboard/templates?type=${slug(c.key)}`,
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
                      isSelected ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-slate-900">{c.label}</h3>
                    <p className="text-xs text-slate-500">{n} template{n === 1 ? '' : 's'}</p>
                  </div>
                </div>
                <ChevronRight
                  size={18}
                  className={`text-slate-400 transition-transform ${isSelected ? 'rotate-90 text-primary' : ''}`}
                />
              </button>
            )
          })}
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

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {PLATFORMS.map(p => (
              <Link
                key={p}
                href={`/dashboard/templates/${slug(selected)}/${slug(p)}`}
                className="card card-link flex items-center gap-3 !p-4 transition-all hover:border-primary group"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <PlatformIcon platform={p} size={20} />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900 group-hover:text-primary transition-colors">
                    {platformLabel(p)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {count(selected, p)} of {STEPS.length} ready
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
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
}: {
  templates: TemplateRow[]
  businessType: string
  platform: string
  isAdmin: boolean
}) {
  const [editing, setEditing] = useState<Editing | null>(null)
  const toggle = useAction()
  const find = (step: string, bType: string, p: string) =>
    templates.find(t => t.step === step && businessTypeOf(t) === bType && t.platform === p)

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link
          href={`/dashboard/templates?type=${slug(businessType)}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2"
        >
          <ArrowLeft size={14} /> Back to mediums in {businessType}
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PlatformIcon platform={platform} size={22} />
          </div>
          <div>
            <h1 className="!mb-0 text-2xl font-bold tracking-tight text-slate-900">
              {businessType === 'General' ? 'General' : businessType} · {platformLabel(platform)}
            </h1>
            <p className="text-xs text-slate-500">
              {platform === 'All'
                ? 'Used across WhatsApp, Instagram, Facebook and Email when no platform-specific template is set.'
                : `Direct outreach messages for ${platform}.`}
            </p>
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

          const usedNote =
            !own || !own.is_active
              ? fallback
                ? `${own ? 'Inactive, so outreach uses' : 'Not customized for this category, uses'} ${businessTypeOf(
                    fallback
                  )} · ${platformLabel(fallback.platform)}`
                : `${own ? 'Inactive' : 'Not set'}, and no fallback template is available. Drafts for this step will be empty.`
              : null

          return (
            <div
              key={step}
              className={`card space-y-3 !p-5 transition-all ${
                own && !own.is_active ? 'opacity-70 bg-slate-50' : ''
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900">{step}</h3>
                  <p className="text-xs text-slate-500">{STEP_SUBTITLES[step] || step}</p>
                </div>
                <div className="flex items-center gap-2">
                  {own && isAdmin && (
                    <>
                      <Switch
                        on={own.is_active}
                        disabled={toggle.pending}
                        onChange={v => toggle.run(() => setTemplateActive(own.id, v))}
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
                          })
                        }
                      >
                        <Pencil size={14} /> Edit
                      </button>
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
                          subject: '',
                          body: fallback?.body || '',
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

      {editing && <EditTemplate value={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

// ---------- Edit / add modal ----------
type Editing = {
  id: string | null
  step: string
  businessType: string
  platform: string
  subject: string
  body: string
}

function EditTemplate({ value, onClose }: { value: Editing; onClose: () => void }) {
  const [v, setV] = useState(value)
  const area = useRef<HTMLTextAreaElement>(null)
  const { run, pending, error } = useAction()

  const insert = (ph: string) => {
    const el = area.current
    const start = el?.selectionStart ?? v.body.length
    const end = el?.selectionEnd ?? v.body.length
    setV({ ...v, body: v.body.slice(0, start) + ph + v.body.slice(end) })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + ph.length, start + ph.length)
    })
  }

  return (
    <Modal
      title={`${v.id ? 'Edit template' : 'Add custom template'} · ${v.step}`}
      open
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={e => {
          e.preventDefault()
          run(
            () =>
              saveTemplate({
                id: v.id,
                step: v.step,
                businessType: v.businessType,
                platform: v.platform,
                subject: v.subject,
                body: v.body,
              }),
            onClose
          )
        }}
      >
        <div className="text-xs font-semibold text-slate-500">
          Target: {v.businessType} · {platformLabel(v.platform)}
        </div>
        <ErrorNote error={error} />

        {hasSubject(v.platform) && (
          <div>
            <label className="label">Email Subject</label>
            <input
              className="input w-full"
              value={v.subject}
              onChange={e => setV({ ...v, subject: e.target.value })}
              placeholder="e.g. Quick question for {business_name}"
            />
          </div>
        )}

        <div>
          <label className="label">Message Body</label>
          <textarea
            ref={area}
            rows={8}
            className="input w-full font-mono text-sm leading-relaxed"
            value={v.body}
            onChange={e => setV({ ...v, body: e.target.value })}
            placeholder="Write your outreach message here…"
            required
          />
        </div>

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
          <button type="button" className="btn btn-secondary" onClick={onClose}>
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
