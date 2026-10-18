'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  Trash2,
  SlidersHorizontal,
  ChevronDown,
  ExternalLink,
  Hotel,
  Utensils,
  Beer,
  Building2,
  X,
} from 'lucide-react'
import { CONFIG, LEAD_CATEGORIES } from '@/lib/config'
import { formatDate } from '@/lib/format'
import { PROBLEM_LABELS } from '@/lib/importFields'
import { updateLeadField, bulkSetField, deleteLeads } from '@/app/dashboard/actions'
import { EmptyState, Modal, Pagination, Spinner } from '@/components/ui'

export type MissingRow = {
  opportunity_id: string
  business_id: string
  business_name: string
  business_type: string
  existing_website: string | null
  has_no_website: boolean
  address: string | null
  postcode: string | null
  branches: { name: string; address: string; postcode: string }[] | null
  services: string[]
  contact_name: string | null
  owner_email: string | null
  owner_whatsapp: string | null
  owner_social: string | null
  owner_contact: string | null
  email: string | null
  whatsapp_number: string | null
  instagram: string | null
  facebook: string | null
  linkedin: string | null
  tech_partner_type: string | null
  tech_partner_name: string | null
  existing_tech_partner: string | null
  gaps_found: string | null
  source: string | null
  import_batch_id: string | null
  batch_file_name: string | null
  batch_uploaded_at: string | null
  problems: string[]
  total_count: number
}

export type BatchItem = {
  id: string
  file_name: string
  uploaded_by: string
  uploader_name: string
  created_at: string
  total_rows: number
  ready_count: number
  missing_count: number
  failed_count: number
}

const TYPE_CARDS = [
  { key: 'Hotel', label: 'Hotels', icon: Hotel },
  { key: 'Restaurant or cafe', label: 'Restaurants & cafes', icon: Utensils },
  { key: 'Pub', label: 'Pubs', icon: Beer },
  { key: 'Property management', label: 'Property management', icon: Building2 },
] as const

export function MissingDataTab({
  rows: initialRows,
  total,
  types,
  problems,
  batches,
  activeType,
  activeProblem,
  activeBatch,
  page,
  pageSize = 50,
  onFilterChange,
}: {
  rows: MissingRow[]
  total: number
  types: { business_type: string; count: number }[]
  problems: { problem: string; label: string; count: number }[]
  batches: BatchItem[]
  activeType: string | null
  activeProblem: string | null
  activeBatch: string | null
  page: number
  pageSize?: number
  onFilterChange: (patch: { type?: string; problem?: string; batch?: string; page?: string }) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rows, setRows] = useState<MissingRow[]>(initialRows)
  const [selected, setSelected] = useState<string[]>([])
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [editSecondary, setEditSecondary] = useState<string>('')
  const [editCheck, setEditCheck] = useState<boolean>(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [cellError, setCellError] = useState<string | null>(null)

  // Bulk actions modal states
  const [showBulkSet, setShowBulkSet] = useState(false)
  const [bulkField, setBulkField] = useState<'category' | 'service' | 'tech_partner_type'>('category')
  const [bulkVal, setBulkVal] = useState<string>('Hotel')
  const [bulkServices, setBulkServices] = useState<string[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [bulkActionBusy, setBulkActionBusy] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  // Sync state if initialRows changes
  if (initialRows !== rows && !editingCell) {
    setRows(initialRows)
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  const allSelected = rows.length > 0 && rows.every(r => selected.includes(r.business_id))
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected([])
    } else {
      setSelected(rows.map(r => r.business_id))
    }
  }

  // Cell editing
  const startEdit = (row: MissingRow, field: string) => {
    setCellError(null)
    setEditingCell({ id: row.business_id, field })
    if (field === 'business_name') {
      setEditValue(row.business_name || '')
    } else if (field === 'category') {
      setEditValue(row.business_type || 'Hotel')
    } else if (field === 'services') {
      setBulkServices(row.services || [])
    } else if (field === 'website') {
      setEditValue(row.existing_website || '')
      setEditCheck(Boolean(row.has_no_website))
    } else if (field === 'address') {
      setEditValue(row.address || '')
    } else if (field === 'postcode') {
      setEditValue(row.postcode || '')
    } else if (field === 'owner_name') {
      setEditValue(row.contact_name || '')
    } else if (field === 'owner_contact') {
      setEditValue(row.owner_email || row.owner_contact || '')
      setEditSecondary(row.owner_whatsapp || '')
    } else if (field === 'business_contact') {
      setEditValue(row.email || '')
      setEditSecondary(row.whatsapp_number || '')
    } else if (field === 'tech_partner') {
      setEditValue(row.tech_partner_type || 'None')
      setEditSecondary(row.tech_partner_name || '')
    } else if (field === 'gaps') {
      setEditValue(row.gaps_found || '')
    }
  }

  const cancelEdit = () => {
    setEditingCell(null)
    setCellError(null)
  }

  const saveCell = async (row: MissingRow) => {
    if (!editingCell) return
    const field = editingCell.field
    setSavingId(row.business_id)
    setCellError(null)

    try {
      let res: any

      if (field === 'business_name') {
        res = await updateLeadField(row.business_id, 'business_name', editValue)
      } else if (field === 'category') {
        res = await updateLeadField(row.business_id, 'category', editValue)
      } else if (field === 'services') {
        res = await updateLeadField(row.business_id, 'services', bulkServices.join(';'))
      } else if (field === 'website') {
        if (editCheck) {
          res = await updateLeadField(row.business_id, 'no_site', 'true')
        } else {
          res = await updateLeadField(row.business_id, 'website', editValue)
        }
      } else if (field === 'address') {
        res = await updateLeadField(row.business_id, 'address', editValue)
      } else if (field === 'postcode') {
        res = await updateLeadField(row.business_id, 'postcode', editValue)
      } else if (field === 'owner_name') {
        res = await updateLeadField(row.business_id, 'owner_name', editValue)
      } else if (field === 'owner_contact') {
        if (editValue.includes('@')) {
          res = await updateLeadField(row.business_id, 'owner_email', editValue)
        } else if (editSecondary) {
          res = await updateLeadField(row.business_id, 'owner_whatsapp', editSecondary)
        } else {
          res = await updateLeadField(row.business_id, 'owner_social', editValue)
        }
      } else if (field === 'business_contact') {
        if (editValue.includes('@')) {
          res = await updateLeadField(row.business_id, 'email', editValue)
        } else if (editSecondary) {
          res = await updateLeadField(row.business_id, 'whatsapp_number', editSecondary)
        } else {
          res = await updateLeadField(row.business_id, 'email', editValue)
        }
      } else if (field === 'tech_partner') {
        res = await updateLeadField(row.business_id, 'tech_partner_type', editValue)
        if (res.ok && (editValue === 'Agency' || editValue === 'DIY') && editSecondary) {
          res = await updateLeadField(row.business_id, 'tech_partner_name', editSecondary)
        }
      } else if (field === 'gaps') {
        res = await updateLeadField(row.business_id, 'gaps_found', editValue)
      }

      if (!res?.ok) {
        setCellError(res?.error || 'Failed to save change.')
        setSavingId(null)
        return
      }

      // Update local row state
      const updatedProblems = res.data?.problems ?? []
      setRows(prev =>
        prev.map(r => {
          if (r.business_id !== row.business_id) return r
          return {
            ...r,
            problems: updatedProblems,
            business_name: field === 'business_name' ? editValue : r.business_name,
            business_type: field === 'category' ? editValue : r.business_type,
            services: field === 'services' ? bulkServices : r.services,
            existing_website: field === 'website' ? (editCheck ? null : editValue) : r.existing_website,
            has_no_website: field === 'website' ? editCheck : r.has_no_website,
            address: field === 'address' ? editValue : r.address,
            postcode: field === 'postcode' ? editValue.toUpperCase() : r.postcode,
            contact_name: field === 'owner_name' ? editValue : r.contact_name,
            owner_email: field === 'owner_contact' && editValue.includes('@') ? editValue : r.owner_email,
            owner_whatsapp: field === 'owner_contact' && editSecondary ? editSecondary : r.owner_whatsapp,
            email: field === 'business_contact' && editValue.includes('@') ? editValue : r.email,
            whatsapp_number: field === 'business_contact' && editSecondary ? editSecondary : r.whatsapp_number,
            tech_partner_type: field === 'tech_partner' ? editValue : r.tech_partner_type,
            tech_partner_name: field === 'tech_partner' ? editSecondary : r.tech_partner_name,
            gaps_found: field === 'gaps' ? editValue : r.gaps_found,
          }
        })
      )

      setEditingCell(null)
      setSavingId(null)
      startTransition(() => {
        router.refresh()
      })
    } catch (e: any) {
      setCellError(e?.message || 'Error updating field')
      setSavingId(null)
    }
  }

  // Bulk actions
  const handleBulkSet = async () => {
    if (!selected.length) return
    setBulkActionBusy(true)
    const val = bulkField === 'service' ? bulkServices.join(';') : bulkVal
    const res = await bulkSetField(selected, bulkField, val)
    setBulkActionBusy(false)
    if (res.ok) {
      setActionMessage(`Updated ${res.data} lead(s).`)
      setShowBulkSet(false)
      setSelected([])
      startTransition(() => {
        router.refresh()
      })
    } else {
      setActionMessage(`Error: ${res.error}`)
    }
  }

  const handleDelete = async () => {
    if (!selected.length) return
    setBulkActionBusy(true)
    const res = await deleteLeads(selected)
    setBulkActionBusy(false)
    if (res.ok) {
      setActionMessage(`Deleted ${res.data} lead(s).`)
      setShowDeleteConfirm(false)
      setSelected([])
      startTransition(() => {
        router.refresh()
      })
    } else {
      setActionMessage(`Error: ${res.error}`)
    }
  }

  const typeCountsMap = Object.fromEntries(types.map(t => [t.business_type, t.count]))

  return (
    <div className="space-y-5">
      {/* 1. Top: 4 Property Type Boxes */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TYPE_CARDS.map(cat => {
          const Icon = cat.icon
          const count = typeCountsMap[cat.key] ?? 0
          const isSelected = activeType === cat.key
          return (
            <button
              type="button"
              key={cat.key}
              onClick={() => {
                onFilterChange({
                  type: isSelected ? undefined : cat.key,
                  page: '1',
                })
              }}
              className={`flex flex-col items-start justify-between rounded-xl border p-4 text-left transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    isSelected ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon size={18} />
                </div>
                {isSelected && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    Filtered
                  </span>
                )}
              </div>
              <div className="mt-4">
                <div className="text-2xl font-extrabold text-slate-900">{count}</div>
                <div className="text-xs font-semibold text-slate-700">{cat.label}</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* 2. Problem Chips & Import Dropdown */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500 mr-1">Problems:</span>
          {problems.map(p => {
            const isChipSelected = activeProblem === p.problem
            return (
              <button
                type="button"
                key={p.problem}
                onClick={() =>
                  onFilterChange({
                    problem: isChipSelected ? undefined : p.problem,
                    page: '1',
                  })
                }
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  isChipSelected
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                }`}
              >
                {p.label} <span className="font-bold">({p.count})</span>
              </button>
            )
          })}
        </div>

        {/* Import Batch Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-slate-500">Import:</span>
          <select
            className="input !py-1 text-xs"
            value={activeBatch || ''}
            onChange={e =>
              onFilterChange({
                batch: e.target.value || undefined,
                page: '1',
              })
            }
          >
            <option value="">All imports</option>
            {batches.map(b => (
              <option key={b.id} value={b.id}>
                {b.file_name}, {formatDate(b.created_at)}, {b.uploader_name} ({b.missing_count} missing)
              </option>
            ))}
          </select>

          {(activeType || activeProblem || activeBatch) && (
            <button
              type="button"
              onClick={() => onFilterChange({ type: undefined, problem: undefined, batch: undefined, page: '1' })}
              className="chip text-xs hover:bg-slate-200"
              title="Clear all filters"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-800">
          <span>{actionMessage}</span>
          <button className="font-bold hover:underline" onClick={() => setActionMessage(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* 3. Bulk Actions Toolbar (when rows selected) */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm">
          <span className="font-semibold text-slate-900">
            {selected.length} lead{selected.length === 1 ? '' : 's'} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setBulkField('category')
                setBulkVal('Hotel')
                setShowBulkSet(true)
              }}
            >
              <SlidersHorizontal size={14} /> Set value
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm text-rose-700 hover:bg-rose-50"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 size={14} /> Delete
            </button>
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-slate-800 ml-2"
              onClick={() => setSelected([])}
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* 4. Missing Leads Table */}
      {rows.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={36} className="text-emerald-500" />}
          title={total === 0 ? 'No missing data' : 'No leads match the filters'}
          text={
            total === 0
              ? 'All leads have complete mandatory fields and are in the Approval queue.'
              : 'Try clearing the property type, problem, or import batch filter.'
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="table-wrap max-h-[640px] overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 bg-white">
            <table className="table text-xs whitespace-nowrap">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr>
                  <th className="w-8 !px-3">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      title="Select all on this page"
                    />
                  </th>
                  <th>Business name</th>
                  <th>Category</th>
                  <th>Services</th>
                  <th>Website / No site</th>
                  <th>Address & Postcode</th>
                  <th>Owner name</th>
                  <th>Owner contact</th>
                  <th>Business contact</th>
                  <th>Tech partner</th>
                  <th>Gaps found</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(row => {
                  const isReady = row.problems.length === 0
                  const isChecked = selected.includes(row.business_id)

                  const hasProb = (code: string) => row.problems.includes(code)
                  const cellClass = (hasError: boolean) =>
                    `cursor-pointer px-2.5 py-1.5 transition-colors ${
                      hasError
                        ? 'border-2 border-rose-500 bg-rose-50/50 rounded font-medium text-rose-950'
                        : 'border border-transparent hover:border-slate-300 rounded text-slate-700'
                    }`

                  return (
                    <tr key={row.business_id} className={isChecked ? 'bg-primary/5' : isReady ? 'bg-emerald-50/30' : ''}>
                      <td className="!px-3">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(row.business_id)}
                        />
                      </td>

                      {/* 1. Business name */}
                      <td className="max-w-[180px] truncate">
                        {editingCell?.id === row.business_id && editingCell.field === 'business_name' ? (
                          <div className="flex items-center gap-1">
                            <input
                              className="input !py-1 text-xs"
                              autoFocus
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={() => saveCell(row)}
                              onKeyDown={e => e.key === 'Enter' && saveCell(row)}
                            />
                            {savingId === row.business_id && <Spinner />}
                          </div>
                        ) : (
                          <div
                            onClick={() => startEdit(row, 'business_name')}
                            className={cellClass(hasProb('name'))}
                            title="Click to edit"
                          >
                            {row.business_name || <i className="text-slate-400">Empty</i>}
                          </div>
                        )}
                      </td>

                      {/* 2. Category */}
                      <td>
                        {editingCell?.id === row.business_id && editingCell.field === 'category' ? (
                          <select
                            className="input !py-1 text-xs"
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => saveCell(row)}
                          >
                            {LEAD_CATEGORIES.map(c => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div
                            onClick={() => startEdit(row, 'category')}
                            className={cellClass(hasProb('category'))}
                            title="Click to change category"
                          >
                            {row.business_type || <i className="text-slate-400">Pick</i>}
                          </div>
                        )}
                      </td>

                      {/* 3. Services */}
                      <td className="max-w-[200px] truncate">
                        {editingCell?.id === row.business_id && editingCell.field === 'services' ? (
                          <div className="space-y-1.5 p-1 bg-white border rounded shadow-md z-20">
                            <div className="flex flex-wrap gap-1">
                              {CONFIG.SERVICES.map(s => {
                                const on = bulkServices.includes(s)
                                return (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() =>
                                      setBulkServices(prev =>
                                        prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                                      )
                                    }
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                      on ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {s}
                                  </button>
                                )
                              })}
                            </div>
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                className="btn btn-secondary !py-0.5 !px-2 text-[10px]"
                                onClick={cancelEdit}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary !py-0.5 !px-2 text-[10px]"
                                onClick={() => saveCell(row)}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => startEdit(row, 'services')}
                            className={cellClass(hasProb('service'))}
                            title="Click to edit services"
                          >
                            {row.services?.length ? row.services.join(', ') : <i className="text-slate-400">Empty</i>}
                          </div>
                        )}
                      </td>

                      {/* 4. Website / No site */}
                      <td className="max-w-[180px] truncate">
                        {editingCell?.id === row.business_id && editingCell.field === 'website' ? (
                          <div className="flex flex-col gap-1 p-1 bg-white border rounded shadow-md">
                            <input
                              className="input !py-1 text-xs"
                              placeholder="https://example.com"
                              disabled={editCheck}
                              autoFocus
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                            />
                            <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                className="checkbox"
                                checked={editCheck}
                                onChange={e => setEditCheck(e.target.checked)}
                              />
                              No site
                            </label>
                            <div className="flex justify-end gap-1 mt-1">
                              <button
                                type="button"
                                className="btn btn-secondary !py-0.5 !px-2 text-[10px]"
                                onClick={cancelEdit}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary !py-0.5 !px-2 text-[10px]"
                                onClick={() => saveCell(row)}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => startEdit(row, 'website')}
                            className={cellClass(hasProb('website'))}
                            title="Click to edit website"
                          >
                            {row.has_no_website ? (
                              <span className="text-slate-500 font-semibold">No site</span>
                            ) : row.existing_website ? (
                              row.existing_website
                            ) : (
                              <i className="text-slate-400">Missing</i>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 5. Address & Postcode */}
                      <td className="max-w-[200px] truncate">
                        {editingCell?.id === row.business_id &&
                        (editingCell.field === 'address' || editingCell.field === 'postcode') ? (
                          <div className="flex flex-col gap-1 p-1 bg-white border rounded shadow-md">
                            <input
                              className="input !py-1 text-xs"
                              placeholder="Address"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                            />
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                className="btn btn-secondary !py-0.5 !px-2 text-[10px]"
                                onClick={cancelEdit}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary !py-0.5 !px-2 text-[10px]"
                                onClick={() => saveCell(row)}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span
                              onClick={() => startEdit(row, 'address')}
                              className={cellClass(hasProb('location'))}
                              title="Click to edit address"
                            >
                              {row.address || (row.branches?.length ? `${row.branches.length} branches` : <i className="text-slate-400">No address</i>)}
                            </span>
                            <span
                              onClick={() => startEdit(row, 'postcode')}
                              className={cellClass(hasProb('postcode'))}
                              title="Click to edit postcode"
                            >
                              {row.postcode || <i className="text-slate-400">Postcode</i>}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 6. Owner name */}
                      <td className="max-w-[140px] truncate">
                        {editingCell?.id === row.business_id && editingCell.field === 'owner_name' ? (
                          <input
                            className="input !py-1 text-xs"
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => saveCell(row)}
                            onKeyDown={e => e.key === 'Enter' && saveCell(row)}
                          />
                        ) : (
                          <div
                            onClick={() => startEdit(row, 'owner_name')}
                            className={cellClass(hasProb('owner_name'))}
                            title="Click to edit owner name"
                          >
                            {row.contact_name || <i className="text-slate-400">Missing</i>}
                          </div>
                        )}
                      </td>

                      {/* 7. Owner contact */}
                      <td className="max-w-[180px] truncate">
                        {editingCell?.id === row.business_id && editingCell.field === 'owner_contact' ? (
                          <div className="flex flex-col gap-1 p-1 bg-white border rounded shadow-md">
                            <input
                              className="input !py-1 text-xs"
                              placeholder="Email or LinkedIn"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                            />
                            <input
                              className="input !py-1 text-xs"
                              placeholder="Mobile (07...)"
                              value={editSecondary}
                              onChange={e => setEditSecondary(e.target.value)}
                            />
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                className="btn btn-secondary !py-0.5 !px-2 text-[10px]"
                                onClick={cancelEdit}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary !py-0.5 !px-2 text-[10px]"
                                onClick={() => saveCell(row)}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => startEdit(row, 'owner_contact')}
                            className={cellClass(hasProb('owner_contact'))}
                            title="Click to edit owner contact"
                          >
                            {row.owner_email || row.owner_whatsapp || row.owner_social || row.owner_contact || (
                              <i className="text-slate-400">Missing</i>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 8. Business contact */}
                      <td className="max-w-[180px] truncate">
                        {editingCell?.id === row.business_id && editingCell.field === 'business_contact' ? (
                          <div className="flex flex-col gap-1 p-1 bg-white border rounded shadow-md">
                            <input
                              className="input !py-1 text-xs"
                              placeholder="Business Email"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                            />
                            <input
                              className="input !py-1 text-xs"
                              placeholder="Business WhatsApp"
                              value={editSecondary}
                              onChange={e => setEditSecondary(e.target.value)}
                            />
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                className="btn btn-secondary !py-0.5 !px-2 text-[10px]"
                                onClick={cancelEdit}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary !py-0.5 !px-2 text-[10px]"
                                onClick={() => saveCell(row)}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => startEdit(row, 'business_contact')}
                            className={cellClass(hasProb('business_contact'))}
                            title="Click to edit business contact"
                          >
                            {row.email || row.whatsapp_number || row.instagram || row.facebook || (
                              <i className="text-slate-400">Missing</i>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 9. Tech partner */}
                      <td className="max-w-[160px] truncate">
                        {editingCell?.id === row.business_id && editingCell.field === 'tech_partner' ? (
                          <div className="flex flex-col gap-1 p-1 bg-white border rounded shadow-md">
                            <select
                              className="input !py-1 text-xs"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                            >
                              <option value="None">None</option>
                              <option value="Agency">Agency</option>
                              <option value="DIY">DIY</option>
                            </select>
                            {editValue !== 'None' && (
                              <input
                                className="input !py-1 text-xs"
                                placeholder="Partner / Tool name"
                                value={editSecondary}
                                onChange={e => setEditSecondary(e.target.value)}
                              />
                            )}
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                className="btn btn-secondary !py-0.5 !px-2 text-[10px]"
                                onClick={cancelEdit}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary !py-0.5 !px-2 text-[10px]"
                                onClick={() => saveCell(row)}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => startEdit(row, 'tech_partner')}
                            className={cellClass(hasProb('tech_partner'))}
                            title="Click to edit tech partner"
                          >
                            {row.tech_partner_type === 'None'
                              ? 'None'
                              : row.tech_partner_type
                              ? `${row.tech_partner_type} (${row.tech_partner_name || '?'})`
                              : row.existing_tech_partner || <i className="text-slate-400">Missing</i>}
                          </div>
                        )}
                      </td>

                      {/* 10. Gaps found */}
                      <td className="max-w-[180px] truncate">
                        {editingCell?.id === row.business_id && editingCell.field === 'gaps' ? (
                          <input
                            className="input !py-1 text-xs"
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => saveCell(row)}
                            onKeyDown={e => e.key === 'Enter' && saveCell(row)}
                          />
                        ) : (
                          <div
                            onClick={() => startEdit(row, 'gaps')}
                            className={cellClass(hasProb('gaps'))}
                            title="Click to edit gaps found"
                          >
                            {row.gaps_found || <i className="text-slate-400">Missing</i>}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        {isReady ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                            <CheckCircle2 size={12} /> Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
                            <AlertCircle size={12} /> {row.problems.length} missing
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {cellError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {cellError}
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              Showing {rows.length} of {total} leads with missing data
            </span>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              basePath="/dashboard/leads"
              params={{
                tab: 'missing',
                type: activeType || undefined,
                problem: activeProblem || undefined,
                batch: activeBatch || undefined,
              }}
            />
          </div>
        </div>
      )}

      {/* Bulk Set Modal */}
      <Modal open={showBulkSet} onClose={() => setShowBulkSet(false)} title={`Set value for ${selected.length} leads`}>
        <div className="space-y-4">
          <div>
            <label className="label">Field to set</label>
            <select
              className="input"
              value={bulkField}
              onChange={e => {
                const f = e.target.value as any
                setBulkField(f)
                if (f === 'category') setBulkVal('Hotel')
                if (f === 'tech_partner_type') setBulkVal('None')
              }}
            >
              <option value="category">Category</option>
              <option value="service">Services to pitch</option>
              <option value="tech_partner_type">Tech partner type</option>
            </select>
          </div>

          {bulkField === 'category' && (
            <div>
              <label className="label">Category value</label>
              <select className="input" value={bulkVal} onChange={e => setBulkVal(e.target.value)}>
                {LEAD_CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {bulkField === 'service' && (
            <div>
              <label className="label">Services to pitch</label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {CONFIG.SERVICES.map(s => {
                  const on = bulkServices.includes(s)
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() =>
                        setBulkServices(prev =>
                          prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                        )
                      }
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        on ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {bulkField === 'tech_partner_type' && (
            <div>
              <label className="label">Tech partner type</label>
              <select className="input" value={bulkVal} onChange={e => setBulkVal(e.target.value)}>
                <option value="None">None</option>
                <option value="Agency">Agency</option>
                <option value="DIY">DIY</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-secondary" onClick={() => setShowBulkSet(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={bulkActionBusy} onClick={handleBulkSet}>
              {bulkActionBusy ? <Spinner /> : `Apply to ${selected.length} leads`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={`Delete ${selected.length} leads?`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete {selected.length} leads? They will be removed permanently.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </button>
            <button className="btn btn-primary !bg-rose-600 hover:!bg-rose-700" disabled={bulkActionBusy} onClick={handleDelete}>
              {bulkActionBusy ? <Spinner /> : `Delete permanently`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
