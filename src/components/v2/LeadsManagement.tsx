'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Download, Plus, Search, Upload, Inbox, CheckCircle2, AlertTriangle, Pencil, Archive, UserPlus, Layers } from 'lucide-react'
import { CONFIG, BUSINESS_TYPES } from '@/lib/config'
import { dueLabel, formatDate } from '@/lib/format'
import { approveLeads, bulkArchive, bulkAssign, bulkServices } from '@/app/dashboard/actions'
import { ChipSelect, EmptyState, ErrorNote, Modal, Pagination, PlatformStatus, Spinner, StageBadge, useAction } from '@/components/ui'
import { BusinessForm } from '@/components/v2/BusinessForm'
import { CsvImportModal } from '@/components/v2/CsvImportModal'

export type PitchRow = {
  opportunity_id: string
  business_id: string
  business_name: string
  business_type: string
  area: string | null
  postcode: string | null
  address: string | null
  google_rating: number | null
  phone: string | null
  email: string | null
  instagram: string | null
  facebook: string | null
  company_type: string | null
  contact_name: string | null
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
  if (!r.business_type) return 'Add the business type'
  if (!r.services_pitched?.length) return 'Add a service to pitch'
  if (!r.phone && !r.email && !r.instagram && !r.facebook && !r.address && !r.postcode) return 'Add a phone, email, social or address'
  return null
}

export function LeadsManagement({
  tab, rows, loadError, total, reviewCount, page, pageSize, params, role, staff,
}: {
  tab: 'all' | 'review'; rows: PitchRow[]; loadError: string | null; total: number; reviewCount: number; page: number; pageSize: number
  params: Record<string, string | undefined>; role: string; staff: Staff[]
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
  const { run, pending, error, setError } = useAction()

  const go = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams()
    Object.entries({ ...params, ...patch, page: patch.page }).forEach(([k, v]) => v && q.set(k, v))
    setSelected([])
    router.push(`/dashboard/leads${q.toString() ? `?${q}` : ''}`)
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

  const approve = (ids: string[]) => {
    const businessIds = Array.from(new Set(rows.filter(r => ids.includes(r.opportunity_id)).map(r => r.business_id)))
    run(() => approveLeads(businessIds), () => {
      setNotice(`${businessIds.length} lead(s) approved. Drafts are ready in Due today.`)
      setSelected([])
    })
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
        {[['all', 'All leads'], ['review', 'Review queue']].map(([k, label]) => (
          <button
            key={k}
            onClick={() => go({ tab: k === 'all' ? undefined : k, stage: undefined, platform: undefined })}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold ${tab === k ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {label}
            {k === 'review' && reviewCount > 0 && <span className="rounded-full bg-amber-100 px-2 text-xs font-bold text-amber-800">{reviewCount}</span>}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap items-center gap-2 !p-3">
        <form
          className="relative min-w-56 flex-1"
          onSubmit={e => { e.preventDefault(); go({ q: (new FormData(e.currentTarget).get('q') as string) || undefined }) }}
        >
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={params.q} placeholder="Search name, area, postcode, phone or email" className="input !pl-9" />
        </form>
        <select className="input !w-auto" value={params.type || ''} onChange={e => go({ type: e.target.value || undefined })}>
          <option value="">All types</option>
          {BUSINESS_TYPES.map(t => <option key={t}>{t}</option>)}
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

      {notice && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
          <button className="font-semibold" onClick={() => setNotice(null)}>Close</button>
        </div>
      )}
      <ErrorNote error={error || loadError} />

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
              {pending ? <Spinner /> : <CheckCircle2 size={15} />} Approve selected
            </button>
          )}
          {isAdmin && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => { setBulk('assign'); setBulkValue('') }}><UserPlus size={15} /> Assign</button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setBulk('services'); setBulkServicesValue([]) }}><Layers size={15} /> Change services</button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={pending}
                onClick={() => run(() => bulkArchive(Array.from(new Set(selectedRows.map(r => r.business_id))), params.archived !== '1'), () => setSelected([]))}
              >
                <Archive size={15} /> {params.archived === '1' ? 'Unarchive' : 'Archive'}
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
                    <><th>Services</th><th>Contact</th><th>Ready?</th><th /></>
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
                            {r.needs_reply && <span className="ml-2 font-semibold text-emerald-700">Needs reply</span>}
                            {r.archived && <span className="ml-2 font-semibold text-slate-500">Archived</span>}
                          </div>
                        </td>
                        {tab === 'review' ? (
                          <>
                            <td className="text-xs">{r.services_pitched.join(', ')}</td>
                            <td className="text-xs text-slate-600">
                              {[r.phone, r.email, r.instagram && `@${r.instagram}`, r.facebook && 'Facebook'].filter(Boolean).join(' · ') || <span className="text-slate-400">None yet</span>}
                            </td>
                            <td className="text-xs">
                              {ready ? <span className="inline-flex items-center gap-1 text-amber-700"><AlertTriangle size={14} /> {ready}</span>
                                : <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={14} /> Ready</span>}
                            </td>
                            <td className="whitespace-nowrap text-right">
                              <button className="btn btn-ghost btn-sm" onClick={() => setEditRow(r)}><Pencil size={14} /> Fix</button>
                              {canIntake && (
                                <button className="btn btn-primary btn-sm" disabled={!!ready || pending} onClick={() => approve([r.opportunity_id])}>Approve</button>
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
                                <td className="text-xs">{r.services_pitched.join(', ')}</td>
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
                              <Detail label="Phone">{r.phone || '-'}</Detail>
                              <Detail label="Email">{r.email || '-'}</Detail>
                              <Detail label="Instagram">{r.instagram ? `@${r.instagram}` : '-'}</Detail>
                              <Detail label="Company type">{r.company_type || 'Unknown'}</Detail>
                              <Detail label="Added">{formatDate(r.created_at)}</Detail>
                            </div>
                            <div className="mt-2 px-2"><Link href={`/dashboard/${r.opportunity_id}`} className="text-sm font-semibold text-primary hover:underline">Open business</Link></div>
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
            business_name: editRow.business_name, business_type: editRow.business_type, area: editRow.area, postcode: editRow.postcode,
            address: editRow.address, phone: editRow.phone, email: editRow.email, instagram: editRow.instagram, facebook: editRow.facebook,
            company_type: editRow.company_type, contact_name: editRow.contact_name,
          }}
        />
      )}
      <Modal open={bulk === 'assign'} onClose={() => setBulk(null)} title={`Assign ${selected.length} pitch(es)`}>
        <div className="space-y-4">
          <select className="input" value={bulkValue} onChange={e => setBulkValue(e.target.value)}>
            <option value="">Choose a salesperson…</option>
            <option value="__none">Nobody (unassign)</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>)}
          </select>
          <ErrorNote error={error} />
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={() => setBulk(null)}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={!bulkValue || pending}
              onClick={() => run(() => bulkAssign(selected, bulkValue === '__none' ? null : bulkValue), () => { setBulk(null); setSelected([]) })}
            >
              {pending && <Spinner />} Assign
            </button>
          </div>
        </div>
      </Modal>
      <Modal open={bulk === 'services'} onClose={() => { setBulk(null); setError(null) }} title={`Change services for ${selected.length} pitch(es)`}>
        <div className="space-y-4">
          <ChipSelect options={CONFIG.SERVICES} value={bulkServicesValue} onChange={setBulkServicesValue} />
          <p className="text-xs text-slate-500">Replaces the services pitched. The change is kept in each pitch&apos;s history.</p>
          <ErrorNote error={error} />
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={() => setBulk(null)}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={!bulkServicesValue.length || pending}
              onClick={() => run(() => bulkServices(selected, bulkServicesValue), () => { setBulk(null); setSelected([]) })}
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
