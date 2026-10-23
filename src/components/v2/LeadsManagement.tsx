'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronDown, ChevronRight, Download, Plus, Search, Upload, Inbox, CheckCircle2, AlertTriangle,
  Pencil, Archive, UserPlus, Layers, Hotel, Utensils, Beer, Building2, MessageCircle, Phone, PhoneOff,
} from 'lucide-react'
import { getPhoneType, whatsappLink } from '@/lib/contact'
import { CONFIG, BUSINESS_TYPES, APPROVAL_QUEUE_TYPES } from '@/lib/config'
import { dueLabel, formatDate } from '@/lib/format'
import { approveLeads, bulkArchive, bulkAssign, bulkServices } from '@/app/dashboard/actions'
import { ChipSelect, EmptyState, ErrorNote, Modal, Pagination, PlatformStatus, Spinner, StageBadge, useAction, toast } from '@/components/ui'
import { BusinessForm } from '@/components/v2/BusinessForm'
import { CsvImportModal } from '@/components/v2/CsvImportModal'
import { MissingDataTab, type MissingRow, type BatchItem } from '@/components/v2/MissingDataTab'
import { startNavigation } from '@/components/NavigationProgress'

const LEAD_CATEGORY_CARDS = [
  {
    key: 'Restaurants and cafes',
    label: 'Restaurants and cafes',
    desc: 'Restaurants, cafes, bakeries & takeaways',
    icon: Utensils,
  },
  {
    key: 'Hotels',
    label: 'Hotels',
    desc: 'Hotels, boutique hotels, B&Bs & guesthouses',
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
] as const

export type PitchRow = {
  opportunity_id: string
  business_id: string
  business_name: string
  business_type: string
  area: string | null
  postcode: string | null
  address: string | null
  google_rating: number | null
  linkedin: string | null
  email: string | null
  whatsapp_number: string | null
  instagram: string | null
  facebook: string | null
  company_type: string | null
  contact_name: string | null
  owner_contact: string | null
  owner_email: string | null
  existing_website: string | null
  has_no_website: boolean
  tech_partner_type: string | null
  tech_partner_name: string | null
  gaps_found: string | null
  archived: boolean
  stage: string
  services_pitched: string[]
  services_won: string[] | null
  assigned_sales_id: string | null
  assigned_sales_name: string | null
  assigned_consultant_name: string | null
  created_at: string
  threads: { id: string; platform: string; status: string; step: number; next_due_on: string | null; paused_reason: string | null }[]
  next_due_on: string | null
  needs_reply: boolean
  total_count: number
}

type Staff = { id: string; full_name: string; role: string }

export function readiness(r: PitchRow): string | null {
  if (!r.business_name) return 'Add business name'
  if (!r.business_type) return 'Add category'
  if (!r.services_pitched?.length) return 'Add service to pitch'
  if (!r.email && !r.instagram && !r.facebook && !r.linkedin && !r.whatsapp_number) return 'Add at least one contact'
  return null
}

export function LeadsManagement({
  tab,
  rows,
  missingRows = [],
  missingTypes = [],
  missingProblems = [],
  importBatches = [],
  loadError,
  total,
  reviewCount,
  missingCount = 0,
  page,
  pageSize,
  params,
  role,
  staff,
  typeCounts = {},
}: {
  tab: 'all' | 'review' | 'missing'
  rows: PitchRow[]
  missingRows?: MissingRow[]
  missingTypes?: { business_type: string; count: number }[]
  missingProblems?: { problem: string; label: string; count: number }[]
  importBatches?: BatchItem[]
  loadError: string | null
  total: number
  reviewCount: number
  missingCount?: number
  page: number
  pageSize: number
  params: Record<string, string | undefined>
  role: string
  staff: Staff[]
  typeCounts?: Record<string, number>
}) {
  const router = useRouter()
  const isAdmin = role === 'admin'
  const canIntake = role === 'admin' || role === 'sales'
  const [selected, setSelected] = useState<string[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [moreCols, setMoreCols] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editRow, setEditRow] = useState<PitchRow | null>(null)
  const [bulk, setBulk] = useState<null | 'assign' | 'services'>(null)
  const [bulkValue, setBulkValue] = useState('')
  const [bulkServicesValue, setBulkServicesValue] = useState<string[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const { run, pending, isPending, error, setError } = useAction()

  const go = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams()
    Object.entries({ ...params, ...patch, page: patch.page }).forEach(([k, v]) => v && q.set(k, v))
    setSelected([])
    const next = `/dashboard/leads${q.toString() ? `?${q}` : ''}`
    if (next !== window.location.pathname + window.location.search) startNavigation()
    router.push(next)
  }

  const selectedRows = rows.filter(r => selected.includes(r.opportunity_id))
  const toggle = (id: string) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]))
  const allOnPage = rows.length > 0 && rows.every(r => selected.includes(r.opportunity_id))

  const exportHref = useMemo(() => {
    const q = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => v && k !== 'page' && q.set(k, v))
    if (selected.length) q.set('ids', selected.join(','))
    return `/api/leads/export?${q}`
  }, [params, selected])

  const approve = (ids: string[], key = 'approve-selected') => {
    const businessIds = Array.from(new Set(rows.filter(r => ids.includes(r.opportunity_id)).map(r => r.business_id)))
    run(() => approveLeads(businessIds), () => {
      const msg = `${businessIds.length} lead(s) approved. Drafts are ready in Due today.`
      setNotice(msg)
      toast.success(msg)
      setSelected([])
    }, { key })
  }

  const filtersActive = ['q', 'type', 'service', 'stage', 'platform', 'assigned', 'archived'].some(k => params[k])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Lead Management</h1>
          <p className="text-sm text-slate-500">Every business and pitch. New leads wait in the review queue until approved.</p>
        </div>
        {canIntake && (
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <a href={exportHref} className="btn btn-secondary"><Download size={16} /> Export CSV{selected.length ? ` (${selected.length})` : ''}</a>
            )}
            <button className="btn btn-secondary" onClick={() => setShowImport(true)}><Upload size={16} /> Import CSV</button>
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add business</button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { key: 'all', label: 'All', count: undefined },
          { key: 'review', label: 'Approval queue', count: reviewCount },
          { key: 'missing', label: 'Missing data', count: missingCount },
        ].map(t => (
          <button
            key={t.key}
            onClick={() =>
              go({
                tab: t.key === 'all' ? undefined : t.key,
                type: undefined,
                problem: undefined,
                batch: undefined,
                q: undefined,
                stage: undefined,
                platform: undefined,
                page: undefined,
              })
            }
            className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
            {typeof t.count === 'number' && t.count > 0 && (
              <span
                className={`rounded-full px-2 text-xs font-bold ${
                  t.key === 'missing'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 break-words whitespace-normal leading-snug">
          <span>{notice}</span>
          <button className="shrink-0 font-semibold hover:opacity-80" onClick={() => setNotice(null)}>Close</button>
        </div>
      )}
      <ErrorNote error={error || loadError} />

      {tab === 'missing' ? (
        <MissingDataTab
          rows={missingRows}
          total={total}
          types={missingTypes}
          problems={missingProblems}
          batches={importBatches}
          activeType={params.type || null}
          activeProblem={params.problem || null}
          activeBatch={params.batch || null}
          page={page}
          pageSize={pageSize}
          onFilterChange={patch => go(patch)}
        />
      ) : (
        <>
          {tab === 'all' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {LEAD_CATEGORY_CARDS.map(cat => {
                const Icon = cat.icon
                const count = typeCounts[cat.key] ?? 0
                const active = (() => {
                  if (!params.type || params.type === 'all') return false
                  if (params.type === cat.key) return true
                  const normP = params.type.toLowerCase().trim()
                  const normK = cat.key.toLowerCase().trim()
                  if (normP === normK) return true
                  if (normK.startsWith('hotel') && normP.startsWith('hotel')) return true
                  if (normK.startsWith('pub') && normP.startsWith('pub')) return true
                  if (normK.startsWith('restaurant') && normP.startsWith('restaurant')) return true
                  if (normK.startsWith('property') && normP.startsWith('property')) return true
                  return false
                })()

                return (
                  <button
                    type="button"
                    key={cat.key}
                    onClick={() => go({ type: active ? undefined : cat.key })}
                    className={`card card-link group relative flex flex-col justify-between !p-5 text-left transition-all ${
                      active
                        ? 'border-primary bg-primary/[0.04] ring-2 ring-primary/20 shadow-sm'
                        : 'hover:border-primary hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
                        active ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700 group-hover:bg-primary/10 group-hover:text-primary'
                      }`}>
                        <Icon size={24} />
                      </div>
                      <ChevronRight size={18} className={`transition-transform duration-200 ${active ? 'rotate-90 text-primary' : 'text-slate-400 group-hover:text-primary'}`} />
                    </div>
                    <div className="mt-6">
                      <div className="text-3xl font-extrabold tracking-tight text-slate-900">{count}</div>
                      <div className={`mt-1 text-sm font-bold transition-colors ${active ? 'text-primary' : 'text-slate-800 group-hover:text-primary'}`}>
                        {cat.label}
                      </div>
                      <div className="text-xs text-slate-400">{cat.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {tab === 'all' && params.type && params.type !== 'all' && (
            <div className="flex flex-wrap items-baseline justify-between gap-2 pt-1">
              <h2 className="!mb-0 text-xl font-bold text-slate-900">
                {params.type}
              </h2>
              <button
                type="button"
                onClick={() => go({ type: undefined })}
                className="text-xs font-semibold text-primary hover:text-primary-hover"
              >
                Clear category filter (view all)
              </button>
            </div>
          )}

          {/* Filters */}
          <div className="card flex flex-wrap items-center gap-2 !p-3">
            <form
              className="relative min-w-56 flex-1"
              onSubmit={e => { e.preventDefault(); go({ q: (new FormData(e.currentTarget).get('q') as string) || undefined }) }}
            >
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input name="q" defaultValue={params.q} placeholder="Search name, area, postcode, LinkedIn or email" className="input !pl-9" />
            </form>
            <select className="input !w-auto" value={params.type || ''} onChange={e => go({ type: e.target.value || undefined })}>
              <option value="">All types</option>
              {APPROVAL_QUEUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="input !w-auto" value={params.service || ''} onChange={e => go({ service: e.target.value || undefined })}>
              <option value="">All services</option>
              {CONFIG.SERVICES.map(s => <option key={s}>{s}</option>)}
            </select>
            {tab === 'all' && (
              <>
                <select className="input !w-auto" value={params.stage || ''} onChange={e => go({ stage: e.target.value || undefined })}>
                  <option value="">All stages</option>
                  <option value="needs-reply">Needs reply</option>
                  {CONFIG.STAGES.map(s => <option key={s}>{s}</option>)}
                </select>
                <select className="input !w-auto" value={params.platform || ''} onChange={e => go({ platform: e.target.value || undefined })}>
                  <option value="">All platforms</option>
                  {CONFIG.PLATFORMS.map(p => <option key={p}>{p}</option>)}
                </select>
              </>
            )}
            {role !== 'consultant' && (
              <select className="input !w-auto" value={params.assigned || ''} onChange={e => go({ assigned: e.target.value || undefined })}>
                <option value="">Anyone</option>
                <option value="me">Assigned to me</option>
                <option value="unassigned">Unassigned</option>
                {isAdmin && staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            )}
            {isAdmin && (
              <label className="flex items-center gap-1.5 px-1 text-sm text-slate-600">
                <input type="checkbox" checked={params.archived === '1'} onChange={e => go({ archived: e.target.checked ? '1' : undefined })} /> Show archived
              </label>
            )}
            {filtersActive && (
              <button className="btn btn-ghost btn-sm" onClick={() => router.push(`/dashboard/leads${tab === 'review' ? '?tab=review' : ''}`)}>Clear</button>
            )}
          </div>

      {/* Bulk bar */}
      {selected.length > 0 && (
        <div className="sticky top-[66px] z-10 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary-bg px-3 py-2 text-sm">
          <b>{selected.length} selected</b>
          {tab === 'review' && canIntake && (
            <button
              className="btn btn-primary btn-sm"
              disabled={pending || selectedRows.some(r => readiness(r))}
              title={selectedRows.some(r => readiness(r)) ? 'Some selected leads are missing details' : ''}
              onClick={() => approve(selected)}
            >
              {isPending('approve-selected') ? <Spinner /> : <CheckCircle2 size={15} />} Approve selected
            </button>
          )}
          {isAdmin && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => { setBulk('assign'); setBulkValue('') }}><UserPlus size={15} /> Assign</button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setBulk('services'); setBulkServicesValue([]) }}><Layers size={15} /> Change services</button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={pending}
                onClick={() => run(
                  () => bulkArchive(Array.from(new Set(selectedRows.map(r => r.business_id))), params.archived !== '1'),
                  () => {
                    toast.success(params.archived === '1' ? 'Leads unarchived successfully.' : 'Leads archived successfully.')
                    setSelected([])
                  },
                  { key: 'archive' }
                )}
              >
                {isPending('archive') ? <Spinner /> : <Archive size={15} />} {params.archived === '1' ? 'Unarchive' : 'Archive'}
              </button>
            </>
          )}
          <button className="btn btn-ghost btn-sm ml-auto" onClick={() => setSelected([])}>Clear selection</button>
        </div>
      )}

      {/* Table */}
      {rows.length === 0 ? (
        tab === 'review' ? (
          <EmptyState icon={<Inbox size={36} />} title="The review queue is empty" text="New leads from Add business or Import CSV appear here before outreach starts.">
            {canIntake && <button className="btn btn-primary" onClick={() => setShowImport(true)}><Upload size={16} /> Import CSV</button>}
          </EmptyState>
        ) : (
          <EmptyState icon={<Inbox size={36} />} title={filtersActive ? 'No leads match these filters' : 'No leads yet'} text={filtersActive ? 'Try clearing a filter.' : 'Add your first business or import a CSV to get started.'}>
            {canIntake && !filtersActive && (
              <>
                <button className="btn btn-secondary" onClick={() => setShowImport(true)}><Upload size={16} /> Import CSV</button>
                <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add business</button>
              </>
            )}
          </EmptyState>
        )
      ) : (
        <>
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{total.toLocaleString('en-GB')} {tab === 'review' ? 'waiting for review' : 'pitches'}</span>
            {tab === 'all' && (
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={moreCols} onChange={e => setMoreCols(e.target.checked)} /> Show more columns
              </label>
            )}
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {(isAdmin || (tab === 'review' && canIntake)) && (
                    <th className="w-8">
                      <input type="checkbox" checked={allOnPage} onChange={() => setSelected(allOnPage ? [] : rows.map(r => r.opportunity_id))} aria-label="Select all on this page" />
                    </th>
                  )}
                  <th className="w-8" />
                  <th>Business</th>
                  {tab === 'review' ? (
                    <>
                      <th>Services</th>
                      <th>WhatsApp</th>
                      <th>Other Contact</th>
                      <th>Ready?</th>
                      <th />
                    </>
                  ) : (
                    <>
                      <th>Platforms reached</th>
                      <th>Next due</th>
                      {moreCols && <><th>Stage</th><th>Services</th><th>Assigned to</th><th>Area</th></>}
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const ready = readiness(r)
                  const due = dueLabel(r.next_due_on)
                  const isOpen = expanded === r.opportunity_id
                  return (
                    <Fragment key={r.opportunity_id}>
                      <tr className={r.archived ? 'opacity-60' : ''}>
                        {(isAdmin || (tab === 'review' && canIntake)) && (
                          <td><input type="checkbox" checked={selected.includes(r.opportunity_id)} onChange={() => toggle(r.opportunity_id)} aria-label={`Select ${r.business_name}`} /></td>
                        )}
                        <td>
                          <button className="btn btn-ghost btn-sm !p-1" onClick={() => setExpanded(isOpen ? null : r.opportunity_id)} aria-label="Show details">
                            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        </td>
                        <td>
                          <Link href={`/dashboard/${r.opportunity_id}`} className="font-semibold hover:text-primary">{r.business_name}</Link>
                          <div className="text-xs text-slate-500">
                            {r.business_type}{r.area ? ` · ${r.area}` : ''}
                            {r.existing_website ? (
                              <a href={r.existing_website} target="_blank" rel="noreferrer" className="ml-2 text-primary hover:text-primary-hover inline-flex items-center gap-0.5">
                                website ↗
                              </a>
                            ) : r.has_no_website ? (
                              <span className="ml-2 text-slate-400 italic">No website</span>
                            ) : null}
                            {r.needs_reply && <span className="ml-2 font-semibold text-emerald-700">Needs reply</span>}
                            {r.archived && <span className="ml-2 font-semibold text-slate-500">Archived</span>}
                          </div>
                        </td>
                        {tab === 'review' ? (
                          <>
                            <td className="text-xs">{r.services_pitched.join(', ')}</td>
                            <td className="whitespace-nowrap text-xs">
                              {(() => {
                                const phone = r.whatsapp_number || (r.owner_contact && /^[+\d\s()-]+$/.test(r.owner_contact) ? r.owner_contact : null)
                                if (!phone) {
                                  return (
                                    <span className="inline-flex items-center gap-1 text-slate-400 italic">
                                      <PhoneOff size={13} className="opacity-50" /> No number
                                    </span>
                                  )
                                }
                                const waUrl = whatsappLink(phone) || `https://wa.me/${phone.replace(/\D/g, '')}`
                                const info = getPhoneType(phone)
                                return (
                                  <div className="flex items-center gap-2">
                                    <a
                                      href={waUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1.5 font-medium text-slate-800 hover:text-emerald-700 transition-colors"
                                      title="Click to open WhatsApp and verify number manually"
                                    >
                                      <MessageCircle size={14} className={info.isWhatsApp ? 'text-emerald-600 shrink-0' : 'text-slate-400 shrink-0'} />
                                      <span className="font-mono">{info.normalized || phone}</span>
                                      <span className="text-[11px] text-slate-400">↗</span>
                                    </a>
                                    {info.isWhatsApp ? (
                                      <span className="text-[11px] font-semibold text-emerald-700">WhatsApp</span>
                                    ) : (
                                      <span className="text-[11px] text-slate-400">Landline · No WA</span>
                                    )}
                                  </div>
                                )
                              })()}
                            </td>
                            <td className="text-xs text-slate-600">
                              {[r.email, r.instagram && `@${r.instagram}`, r.facebook && 'Facebook', r.linkedin && 'LinkedIn'].filter(Boolean).join(' · ') || <span className="text-slate-400">None</span>}
                            </td>
                            <td className="text-xs">
                              {ready ? <span className="inline-flex items-center gap-1 text-amber-700"><AlertTriangle size={14} /> {ready}</span>
                                : <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={14} /> Ready</span>}
                            </td>
                            <td className="whitespace-nowrap text-right">
                              <button className="btn btn-ghost btn-sm" onClick={() => setEditRow(r)}><Pencil size={14} /> Fix</button>
                              {canIntake && (
                                <button className="btn btn-primary btn-sm" disabled={!!ready || pending} onClick={() => approve([r.opportunity_id], `approve-${r.opportunity_id}`)}>{isPending(`approve-${r.opportunity_id}`) && <Spinner size={14} />} Approve</button>
                              )}
                            </td>
                          </>
                        ) : (
                          <>
                            <td>
                              <div className="flex flex-wrap gap-1.5">
                                {r.threads.length ? r.threads.map(t => <PlatformStatus key={t.platform} platform={t.platform} status={t.status} step={t.step} />)
                                  : <span className="text-xs text-slate-400">{r.stage === 'Needs review' ? 'Waiting for review' : 'Not started'}</span>}
                              </div>
                            </td>
                            <td className={`whitespace-nowrap text-sm ${due.tone === 'overdue' ? 'font-semibold text-red-600' : due.tone === 'today' ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>{due.text}</td>
                            {moreCols && (
                              <>
                                <td><StageBadge stage={r.stage} /></td>
                                <td>{r.services_pitched.join(', ')}</td>
                                <td className="text-sm">{r.assigned_sales_name || <span className="text-slate-400">Unassigned</span>}</td>
                                <td className="text-sm">{r.area || '-'}</td>
                              </>
                            )}
                          </>
                        )}
                      </tr>
                      {isOpen && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={12}>
                            <div className="grid grid-cols-1 gap-x-8 gap-y-2 px-2 py-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                              <Detail label="Stage"><StageBadge stage={r.stage} /></Detail>
                              <Detail label="Services pitched">{r.services_pitched.join(', ')}</Detail>
                              {r.services_won?.length ? <Detail label="Services won">{r.services_won.join(', ')}</Detail> : null}
                              <Detail label="Assigned to">{r.assigned_sales_name || 'Unassigned'}{r.assigned_consultant_name ? ` (consultant: ${r.assigned_consultant_name})` : ''}</Detail>
                              <Detail label="Area">{[r.area, r.postcode].filter(Boolean).join(', ') || '-'}</Detail>
                              <Detail label="Website">{r.existing_website ? <a href={r.existing_website} target="_blank" rel="noreferrer" className="text-primary hover:text-primary-hover">{r.existing_website}</a> : r.has_no_website ? 'Marked as no website' : '-'}</Detail>
                              <Detail label="Phone / WhatsApp">
                                {(() => {
                                  const phone = r.whatsapp_number || (r.owner_contact && /^[+\d\s()-]+$/.test(r.owner_contact) ? r.owner_contact : null)
                                  if (!phone) return <span className="text-slate-400 italic">None</span>
                                  const waUrl = whatsappLink(phone) || `https://wa.me/${phone.replace(/\D/g, '')}`
                                  const info = getPhoneType(phone)
                                  return (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <a
                                        href={waUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 font-mono text-slate-800 hover:text-emerald-700 transition-colors"
                                        title="Click to open WhatsApp and verify number manually"
                                      >
                                        <MessageCircle size={13} className={info.isWhatsApp ? 'text-emerald-600' : 'text-slate-400'} />
                                        <span>{info.normalized || phone}</span>
                                        <span className="text-xs text-slate-400">↗</span>
                                      </a>
                                      {info.isWhatsApp ? (
                                        <span className="text-xs font-semibold text-emerald-700">Present on WhatsApp ({info.label})</span>
                                      ) : (
                                        <span className="text-xs text-slate-400">Not on WhatsApp ({info.label})</span>
                                      )}
                                    </div>
                                  )
                                })()}
                              </Detail>
                              <Detail label="Email">{r.email || '-'}</Detail>
                              <Detail label="Instagram">{r.instagram ? `@${r.instagram}` : '-'}</Detail>
                              <Detail label="LinkedIn">{r.linkedin || '-'}</Detail>
                              <Detail label="Owner name">{r.contact_name || '-'}</Detail>
                              <Detail label="Owner contact">{r.owner_contact || r.owner_email || '-'}</Detail>
                              <Detail label="Tech partner">{r.tech_partner_type ? (r.tech_partner_type === 'None' ? 'None' : `${r.tech_partner_type}${r.tech_partner_name ? ` (${r.tech_partner_name})` : ''}`) : '-'}</Detail>
                              <Detail label="Gaps found">{r.gaps_found || '-'}</Detail>
                              <Detail label="Company type">{r.company_type || 'Unknown'}</Detail>
                              <Detail label="Added">{formatDate(r.created_at)}</Detail>
                            </div>
                            <div className="mt-2 px-2"><Link href={`/dashboard/${r.opportunity_id}`} className="text-sm font-semibold text-primary hover:text-primary-hover">Open full business details →</Link></div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} basePath="/dashboard/leads" params={params} />
        </>
      )}
    </>
  )}

      {/* Modals */}
      {showAdd && <BusinessForm open mode="add" onClose={() => setShowAdd(false)} />}
      {showImport && <CsvImportModal open onClose={() => setShowImport(false)} />}
      {editRow && (
        <BusinessForm
          open
          mode="edit"
          businessId={editRow.business_id}
          onClose={() => setEditRow(null)}
          initial={{
            business_name: editRow.business_name,
            business_type: editRow.business_type,
            area: editRow.area,
            postcode: editRow.postcode,
            address: editRow.address,
            linkedin: editRow.linkedin,
            email: editRow.email,
            whatsapp_number: editRow.whatsapp_number,
            instagram: editRow.instagram,
            facebook: editRow.facebook,
            company_type: editRow.company_type,
            contact_name: editRow.contact_name,
            owner_contact: editRow.owner_contact || editRow.owner_email,
            existing_website: editRow.existing_website,
            has_no_website: editRow.has_no_website,
            existing_tech_partner: editRow.tech_partner_type === 'None'
              ? 'None'
              : editRow.tech_partner_name && editRow.tech_partner_type
                ? `${editRow.tech_partner_type} (${editRow.tech_partner_name})`
                : editRow.tech_partner_name || editRow.tech_partner_type || null,
            gaps_found: editRow.gaps_found,
          }}
        />
      )}
      <Modal open={bulk === 'assign'} onClose={() => setBulk(null)} locked={pending} title={`Assign ${selected.length} pitch(es)`}>
        <div className="space-y-4">
          <select className="input" value={bulkValue} onChange={e => setBulkValue(e.target.value)}>
            <option value="">Choose a salesperson…</option>
            <option value="__none">Nobody (unassign)</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>)}
          </select>
          <ErrorNote error={error} />
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={() => setBulk(null)} disabled={pending}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={!bulkValue || pending}
              onClick={() => run(
                () => bulkAssign(selected, bulkValue === '__none' ? null : bulkValue),
                () => {
                  toast.success(`Assigned ${selected.length} lead(s) successfully.`)
                  setBulk(null)
                  setSelected([])
                }
              )}
            >
              {pending && <Spinner />} Assign
            </button>
          </div>
        </div>
      </Modal>
      <Modal open={bulk === 'services'} onClose={() => { setBulk(null); setError(null) }} locked={pending} title={`Change services for ${selected.length} pitch(es)`}>
        <div className="space-y-4">
          <ChipSelect options={CONFIG.SERVICES} value={bulkServicesValue} onChange={setBulkServicesValue} />
          <p className="text-xs text-slate-500">Replaces the services pitched. The change is kept in each pitch&apos;s history.</p>
          <ErrorNote error={error} />
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={() => setBulk(null)} disabled={pending}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={!bulkServicesValue.length || pending}
              onClick={() => run(
                () => bulkServices(selected, bulkServicesValue),
                () => {
                  toast.success(`Updated pitched services for ${selected.length} lead(s).`)
                  setBulk(null)
                  setSelected([])
                }
              )}
            >
              {pending && <Spinner />} Save
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <div>{children}</div>
    </div>
  )
}
