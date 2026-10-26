'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  Trash2,
  SlidersHorizontal,
  X,
  Check,
} from 'lucide-react'
import { categoryNames } from '@/lib/lists'
import { formatDate } from '@/lib/format'
import { PROBLEM_LABELS } from '@/lib/importFields'
import { updateLeadField, updateLeadAddressAndPostcode, bulkSetField, deleteLeads } from '@/app/dashboard/actions'
import { EmptyState, Modal, Pagination, Spinner, ButtonSpinner, toast } from '@/components/ui'
import { useLists } from '@/components/ListsContext'
import { CategoryIcon } from '@/components/CategoryIcon'

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
  owner_contact: string | null
  email: string | null
  whatsapp_number: string | null
  instagram: string | null
  facebook: string | null
  linkedin: string | null
  tech_partner_type: string | null
  tech_partner_name: string | null
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


const FIELD_LABELS: Record<string, string> = {
  business_name: 'Business name',
  category: 'Category',
  services: 'Services',
  website: 'Website',
  address: 'Address & Postcode',
  postcode: 'Address & Postcode',
  owner_name: 'Owner name',
  owner_contact: 'Owner contact',
  business_contact: 'Business contact',
  tech_partner: 'Tech partner',
  gaps: 'Gaps found',
}

function CellEditorFooter({
  onCancel,
}: {
  onCancel: () => void
  onSave?: () => void
  isSaving?: boolean
}) {
  return (
    <div className="flex justify-end gap-1 mt-1">
      <button
        type="button"
        className="btn btn-secondary !py-0.5 !px-2 text-[10px]"
        onClick={onCancel}
      >
        Cancel
      </button>
      <button
        type="submit"
        className="btn btn-primary !py-0.5 !px-2 text-[10px] inline-flex items-center gap-1"
      >
        <span>Save</span>
      </button>
    </div>
  )
}

function ActiveCellEditor({
  children,
  onCancel,
  onSave,
  className = '',
  shake = false,
}: {
  children: React.ReactNode
  onCancel: () => void
  onSave: () => void
  className?: string
  shake?: boolean
}) {
  const containerRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    function handlePointerDown(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCancel()
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel()
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onCancel])

  return (
    <form
      ref={containerRef}
      onSubmit={e => {
        e.preventDefault()
        onSave()
      }}
      className={`flex flex-col gap-1.5 p-2 bg-white border rounded-lg shadow-lg z-20 ${shake ? 'motion-shake border-rose-400 ring-2 ring-rose-100' : 'motion-dropdown-in border-slate-200'} ${className}`}
    >
      {children}
    </form>
  )
}

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
  const lists = useLists()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rows, setRows] = useState<MissingRow[]>(initialRows)
  const [selected, setSelected] = useState<string[]>([])
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [editSecondary, setEditSecondary] = useState<string>('')
  const [editCheck, setEditCheck] = useState<boolean>(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savingField, setSavingField] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState<{ id: string; field: string } | null>(null)
  const [cellError, setCellError] = useState<string | null>(null)

  // Bulk actions modal states
  const [showBulkSet, setShowBulkSet] = useState(false)
  const [bulkField, setBulkField] = useState<'category' | 'service' | 'tech_partner_type'>('category')
  const [bulkVal, setBulkVal] = useState<string>(lists.categories[0]?.name ?? '')
  const [bulkServices, setBulkServices] = useState<string[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [bulkActionBusy, setBulkActionBusy] = useState(false)

  // Maintain local overrides so background initialRows updates don't wipe optimistic/saved state
  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<MissingRow>>>({})

  // Sync state if initialRows changes, merging local overrides
  useEffect(() => {
    if (!editingCell) {
      setRows(
        initialRows.map(r => {
          const overrides = localOverrides[r.business_id]
          if (!overrides) return r
          return {
            ...r,
            ...overrides,
          }
        })
      )
    }
  }, [initialRows, editingCell, localOverrides])

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
      setEditValue(row.business_type || lists.categories[0]?.name || '')
    } else if (field === 'services') {
      setBulkServices(row.services || [])
    } else if (field === 'website') {
      setEditValue(row.existing_website || '')
      setEditCheck(Boolean(row.has_no_website))
    } else if (field === 'address' || field === 'postcode') {
      setEditValue(row.address || '')
      setEditSecondary(row.postcode || '')
    } else if (field === 'owner_name') {
      setEditValue(row.contact_name || '')
    } else if (field === 'owner_contact') {
      setEditValue(row.owner_contact || row.owner_email || '')
      setEditSecondary('')
    } else if (field === 'business_contact') {
      setEditValue(row.email || '')
      setEditSecondary(row.whatsapp_number || '')
    } else if (field === 'tech_partner') {
      const existing = (
        row.tech_partner_type === 'None'
          ? 'None'
          : row.tech_partner_type && row.tech_partner_name
          ? `${row.tech_partner_type} (${row.tech_partner_name})`
          : row.tech_partner_type || ''
      )
      setEditValue(existing)
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
    let editVal = editValue
    const editSec = editSecondary
    const editChk = editCheck
    const servicesVal = [...bulkServices]

    // Validation
    if (field === 'business_name' && !editVal.trim()) {
      setCellError('Business name is required.')
      toast.error('Business name is required.')
      return
    }

    // Capture previous row state in case of rollback
    const previousRow = { ...row }

    // 1. Immediately close the editing popup card
    setEditingCell(null)
    setCellError(null)

    // 2. Compute optimistic row data immediately
    const cleanTp = editVal.trim()
    const tpType = cleanTp.toLowerCase() === 'none' || !cleanTp ? 'None' : cleanTp.toLowerCase().startsWith('diy') ? 'DIY' : 'Agency'

    // If saving gaps and user left empty or typed 'none', actual value is 'None'
    const finalGaps = field === 'gaps' ? (editVal.trim() || 'None') : (row.gaps_found ?? null)
    if (field === 'gaps') {
      editVal = editVal.trim() || 'None'
    }

    const optimisticRowData: Partial<MissingRow> = {
      business_name: field === 'business_name' ? editVal : row.business_name,
      business_type: field === 'category' ? editVal : row.business_type,
      services: field === 'services' ? servicesVal : row.services,
      existing_website: field === 'website' ? (editChk ? null : editVal) : row.existing_website,
      has_no_website: field === 'website' ? editChk : row.has_no_website,
      address: (field === 'address' || field === 'postcode') ? editVal : row.address,
      postcode: (field === 'address' || field === 'postcode') ? editSec.toUpperCase() : row.postcode,
      contact_name: field === 'owner_name' ? editVal : row.contact_name,
      owner_contact: field === 'owner_contact' ? editVal : row.owner_contact,
      owner_email: field === 'owner_contact' && editVal.includes('@') ? editVal : row.owner_email,
      email: field === 'business_contact' && editVal.includes('@') ? editVal : row.email,
      whatsapp_number: field === 'business_contact' && editSec ? editSec : row.whatsapp_number,
      tech_partner_type: field === 'tech_partner' ? tpType : row.tech_partner_type,
      tech_partner_name: field === 'tech_partner' ? (cleanTp.toLowerCase() === 'none' || !cleanTp ? null : cleanTp) : row.tech_partner_name,
      gaps_found: field === 'gaps' ? finalGaps : row.gaps_found,
    }

    // Persist to localOverrides so background revalidations never wipe optimistic state
    setLocalOverrides(prev => ({
      ...prev,
      [row.business_id]: {
        ...(prev[row.business_id] || {}),
        ...optimisticRowData,
      },
    }))

    // Update rows state INSTANTLY (0ms latency!)
    setRows(prev =>
      prev.map(r => {
        if (r.business_id !== row.business_id) return r
        return {
          ...r,
          ...optimisticRowData,
        }
      })
    )

    // 3. Show "Saving..." on the row until the server confirms
    setSavingId(row.business_id)
    setSavingField(field)
    const fieldLabel = FIELD_LABELS[field] || 'Field'

    // 4. Send save request to the fast API route (bypasses Next.js page overhead)
    try {
      const postField = (body: Record<string, unknown>) =>
        fetch('/api/leads/update-field', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then(r => r.json())
      // Second request when one edit writes two fields (email + WhatsApp)
      let extraSave: Promise<{ ok?: boolean; error?: string }> | null = null

      let payload: any = {
        businessId: row.business_id,
        field: field === 'address' || field === 'postcode' ? 'address_and_postcode' : field,
        value: editVal,
      }

      if (field === 'services') {
        payload.value = servicesVal.join(';')
      } else if (field === 'website') {
        if (editChk) {
          payload.field = 'has_no_website'
          payload.value = 'true'
        } else {
          payload.field = 'existing_website'
          payload.value = editVal
        }
      } else if (field === 'address' || field === 'postcode') {
        payload.value = editVal
        payload.secondaryValue = editSec
      } else if (field === 'owner_name') {
        payload.field = 'owner_name'
      } else if (field === 'business_contact') {
        if (editVal.includes('@') && editSec) {
          payload.field = 'email'
          extraSave = postField({ businessId: row.business_id, field: 'whatsapp_number', value: editSec })
        } else if (editSec) {
          payload.field = 'whatsapp_number'
          payload.value = editSec
        } else {
          payload.field = 'email'
          payload.value = editVal
        }
      } else if (field === 'gaps') {
        payload.field = 'gaps_found'
        payload.value = finalGaps
      }

      const [res, extraRes] = await Promise.all([postField(payload), extraSave])
      if (res?.ok && extraRes && !extraRes.ok) {
        res.ok = false
        res.error = extraRes.error || 'Saved the email, but the WhatsApp number could not be saved.'
      }

      if (!res?.ok) {
        // Rollback on server error
        const errMsg = res?.error || 'Failed to save change.'
        setLocalOverrides(prev => {
          const next = { ...prev }
          delete next[row.business_id]
          return next
        })
        setRows(prev => prev.map(r => (r.business_id === row.business_id ? previousRow : r)))
        setJustSaved(null)
        setCellError(errMsg)
        toast.error(errMsg)
        setEditingCell({ id: row.business_id, field })
        return
      }

      // Reconcile server problems
      const updatedProblems = res.data?.problems ?? []
      setLocalOverrides(prev => ({
        ...prev,
        [row.business_id]: {
          ...(prev[row.business_id] || {}),
          ...optimisticRowData,
          problems: updatedProblems,
        },
      }))
      setRows(prev =>
        prev.map(r => (r.business_id === row.business_id ? { ...r, ...optimisticRowData, problems: updatedProblems } : r))
      )

      // 5. Confirmed by the server: green checkmark + toast
      setJustSaved({ id: row.business_id, field })
      setTimeout(() => {
        setJustSaved(prev => (prev?.id === row.business_id && prev.field === field ? null : prev))
      }, 2000)
      if (updatedProblems.length === 0) {
        toast.success(`"${row.business_name || editVal}" is complete! Moved to Ready.`)
      } else {
        toast.success(`Saved ${fieldLabel}.`)
      }
    } catch (e: any) {
      const errMsg = e?.message || 'Error updating field'
      setLocalOverrides(prev => {
        const next = { ...prev }
        delete next[row.business_id]
        return next
      })
      setRows(prev => prev.map(r => (r.business_id === row.business_id ? previousRow : r)))
      setJustSaved(null)
      setCellError(errMsg)
      toast.error(errMsg)
      setEditingCell({ id: row.business_id, field })
    } finally {
      setSavingId(prev => (prev === row.business_id ? null : prev))
      setSavingField(prev => (prev === field ? null : prev))
    }
  }

  // Bulk actions
  const handleBulkSet = async () => {
    if (!selected.length) return
    setBulkActionBusy(true)
    const val = bulkField === 'service' ? bulkServices.join(';') : bulkVal
    let res: Awaited<ReturnType<typeof bulkSetField>>
    try {
      res = await bulkSetField(selected, bulkField, val)
    } catch {
      res = { ok: false, error: 'Could not reach the server. Check your connection and try again.' }
    } finally {
      setBulkActionBusy(false)
    }
    if (res.ok) {
      toast.success(`Updated ${res.data} lead(s).`)
      setShowBulkSet(false)
      setSelected([])
      startTransition(() => {
        router.refresh()
      })
    } else {
      toast.error(res.error)
    }
  }

  const handleDelete = async () => {
    if (!selected.length) return
    setBulkActionBusy(true)
    let res: Awaited<ReturnType<typeof deleteLeads>>
    try {
      res = await deleteLeads(selected)
    } catch {
      res = { ok: false, error: 'Could not reach the server. Check your connection and try again.' }
    } finally {
      setBulkActionBusy(false)
    }
    if (res.ok) {
      toast.success(`Deleted ${res.data} lead(s).`)
      setShowDeleteConfirm(false)
      setSelected([])
      startTransition(() => {
        router.refresh()
      })
    } else {
      toast.error(res.error)
    }
  }

  const typeCountsMap = Object.fromEntries(types.map(t => [t.business_type, t.count]))

  return (
    <div className="space-y-5">
      {/* 1. Top: 4 Property Type Boxes */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {lists.categories.map(cat => {
          const count = typeCountsMap[cat.name] ?? 0
          const isSelected = activeType === cat.name
          return (
            <button
              type="button"
              key={cat.name}
              onClick={() => {
                onFilterChange({
                  type: isSelected ? undefined : cat.name,
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
                  <CategoryIcon name={cat.icon_name} size={18} />
                </div>
                {isSelected && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    Filtered
                  </span>
                )}
              </div>
              <div className="mt-4">
                <div className="text-2xl font-extrabold text-slate-900">{count}</div>
                <div className="text-xs font-semibold text-slate-700">{cat.name}</div>
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
                setBulkVal(lists.categories[0]?.name ?? '')
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
        <div className="space-y-2">
          {/* Active Refresh / Preloader Bar */}
          <div className="flex items-center justify-between min-h-[26px] px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">
                Showing {rows.length} lead{rows.length === 1 ? '' : 's'} on this page
              </span>
              {isPending && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 border border-sky-200 px-2.5 py-0.5 text-xs font-semibold text-sky-700 animate-pulse">
                  <ButtonSpinner size={12} className="text-sky-600" />
                  <span>Syncing updates & counts…</span>
                </span>
              )}
            </div>
            {isPending && (
              <span className="text-[11px] font-medium text-slate-400">
                Fetching latest data…
              </span>
            )}
          </div>

          <div className="relative rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            {/* Top indeterminate loading bar */}
            {isPending && (
              <div className="absolute top-0 left-0 right-0 z-30 h-1 overflow-hidden bg-primary/20">
                <div className="h-full bg-primary animate-pulse w-full" />
              </div>
            )}

            <div className={`table-wrap max-h-[640px] overflow-x-auto overflow-y-auto transition-opacity duration-200 ${isPending ? 'opacity-75' : 'opacity-100'}`}>
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
                    const isRowSaving = savingId === row.business_id

                    const hasProb = (code: string) => row.problems.includes(code)
                    // Amber pulse while saving, green flash once the server confirms
                    const cellClass = (hasError: boolean, fields: string[]) => {
                      const isSaved = justSaved?.id === row.business_id && fields.includes(justSaved.field)
                      const isSaving = isRowSaving && !!savingField && fields.includes(savingField)
                      return `cursor-pointer px-2.5 py-1.5 transition-all ${
                        isSaving
                          ? 'motion-saving rounded font-medium text-slate-900 border border-amber-200'
                          : isSaved
                          ? 'motion-saved rounded font-medium text-slate-900 border border-transparent'
                          : hasError
                          ? 'border-2 border-rose-500 bg-rose-50/50 rounded font-medium text-rose-950'
                          : 'border border-transparent hover:border-slate-300 rounded text-slate-700'
                      }`
                    }

                    return (
                      <tr
                        key={row.business_id}
                        className={`transition-colors ${
                          isChecked
                            ? 'bg-primary/5'
                            : isRowSaving
                            ? 'bg-amber-50/30'
                            : isReady
                            ? 'bg-emerald-50/30'
                            : ''
                        }`}
                      >
                        <td className="!px-3">
                          <input
                            type="checkbox"
                            className="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelect(row.business_id)}
                          />
                        </td>

                        {/* 1. Business name */}
                        <td className="max-w-[200px]">
                          {editingCell?.id === row.business_id && editingCell.field === 'business_name' ? (
                            <ActiveCellEditor shake={!!cellError} onCancel={cancelEdit} onSave={() => saveCell(row)} className="min-w-[200px]">
                              <div>
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Business Name</span>
                                <input
                                  className="input !py-1 text-xs w-full"
                                  autoFocus
                                  placeholder="Business name"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveCell(row)
                                    if (e.key === 'Escape') cancelEdit()
                                  }}
                                />
                              </div>
                              <CellEditorFooter onCancel={cancelEdit} onSave={() => saveCell(row)} />
                            </ActiveCellEditor>
                          ) : (
                            <div
                              onClick={() => startEdit(row, 'business_name')}
                              className={cellClass(hasProb('name'), ['business_name'])}
                              title="Click to edit"
                            >
                              {justSaved?.id === row.business_id && justSaved.field === 'business_name' ? (
                                <span className="inline-flex items-center gap-1.5 text-slate-900 font-medium">
                                  <CheckCircle2 size={13} strokeWidth={2.5} className="text-emerald-600 shrink-0 motion-check-pop" />
                                  {row.business_name || <i className="text-slate-400">Empty</i>}
                                </span>
                              ) : (
                                row.business_name || <i className="text-slate-400">Empty</i>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 2. Category */}
                        <td className="max-w-[180px]">
                          {editingCell?.id === row.business_id && editingCell.field === 'category' ? (
                            <ActiveCellEditor shake={!!cellError} onCancel={cancelEdit} onSave={() => saveCell(row)} className="min-w-[180px]">
                              <div>
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Category</span>
                                <select
                                  className="input !py-1 text-xs w-full"
                                  autoFocus
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveCell(row)
                                    if (e.key === 'Escape') cancelEdit()
                                  }}
                                >
                                  {categoryNames(lists).map(c => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <CellEditorFooter onCancel={cancelEdit} onSave={() => saveCell(row)} />
                            </ActiveCellEditor>
                          ) : (
                            <div
                              onClick={() => startEdit(row, 'category')}
                              className={cellClass(hasProb('category'), ['category'])}
                              title="Click to change category"
                            >
                              {justSaved?.id === row.business_id && justSaved.field === 'category' ? (
                                <span className="inline-flex items-center gap-1.5 text-slate-900 font-medium">
                                  <CheckCircle2 size={13} strokeWidth={2.5} className="text-emerald-600 shrink-0 motion-check-pop" />
                                  {row.business_type}
                                </span>
                              ) : (
                                row.business_type || <i className="text-slate-400">Pick</i>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 3. Services */}
                        <td className="max-w-[220px]">
                          {editingCell?.id === row.business_id && editingCell.field === 'services' ? (
                            <ActiveCellEditor shake={!!cellError} onCancel={cancelEdit} onSave={() => saveCell(row)} className="min-w-[210px]">
                              <div>
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Services Pitched</span>
                                <div className="flex flex-wrap gap-1">
                                  {lists.services.map(s => {
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
                                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                                          on ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                      >
                                        {s}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                              <CellEditorFooter onCancel={cancelEdit} onSave={() => saveCell(row)} />
                            </ActiveCellEditor>
                          ) : (
                            <div
                              onClick={() => startEdit(row, 'services')}
                              className={cellClass(hasProb('service'), ['services'])}
                              title="Click to edit services"
                            >
                              {justSaved?.id === row.business_id && justSaved.field === 'services' ? (
                                <span className="inline-flex items-center gap-1.5 text-slate-900 font-medium">
                                  <CheckCircle2 size={13} strokeWidth={2.5} className="text-emerald-600 shrink-0 motion-check-pop" />
                                  {row.services?.join(', ')}
                                </span>
                              ) : row.services?.length ? (
                                row.services.join(', ')
                              ) : (
                                <i className="text-slate-400">Empty</i>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 4. Website / No site */}
                        <td className="max-w-[200px]">
                          {editingCell?.id === row.business_id && editingCell.field === 'website' ? (
                            <ActiveCellEditor shake={!!cellError} onCancel={cancelEdit} onSave={() => saveCell(row)} className="min-w-[200px]">
                              <div>
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Website</span>
                                <input
                                  className="input !py-1 text-xs w-full"
                                  placeholder="https://example.com"
                                  disabled={editCheck}
                                  autoFocus
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveCell(row)
                                    if (e.key === 'Escape') cancelEdit()
                                  }}
                                />
                              </div>
                              <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  className="checkbox"
                                  checked={editCheck}
                                  onChange={e => setEditCheck(e.target.checked)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveCell(row)
                                  }}
                                />
                                No site
                              </label>
                              <CellEditorFooter onCancel={cancelEdit} onSave={() => saveCell(row)} />
                            </ActiveCellEditor>
                          ) : (
                            <div
                              onClick={() => startEdit(row, 'website')}
                              className={cellClass(hasProb('website'), ['website'])}
                              title="Click to edit website"
                            >
                              {justSaved?.id === row.business_id && justSaved.field === 'website' ? (
                                <span className="inline-flex items-center gap-1.5 text-slate-900 font-medium">
                                  <CheckCircle2 size={13} strokeWidth={2.5} className="text-emerald-600 shrink-0 motion-check-pop" />
                                  {row.has_no_website ? 'No site' : row.existing_website}
                                </span>
                              ) : row.has_no_website ? (
                                <span className="text-slate-400 italic">No site</span>
                              ) : row.existing_website ? (
                                row.existing_website
                              ) : (
                                <i className="text-slate-400">Missing</i>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 5. Address & Postcode */}
                        <td className="max-w-[240px]">
                          {editingCell?.id === row.business_id &&
                          (editingCell.field === 'address' || editingCell.field === 'postcode') ? (
                            <ActiveCellEditor shake={!!cellError} onCancel={cancelEdit} onSave={() => saveCell(row)} className="min-w-[200px]">
                              <div>
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Address</span>
                                <input
                                  className="input !py-1 text-xs w-full"
                                  placeholder="Street, City, Area"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  autoFocus={editingCell.field === 'address'}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveCell(row)
                                    if (e.key === 'Escape') cancelEdit()
                                  }}
                                />
                              </div>
                              <div>
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Postcode</span>
                                <input
                                  className="input !py-1 text-xs w-full uppercase"
                                  placeholder="e.g. SW1A 1AA or 685612"
                                  value={editSecondary}
                                  onChange={e => setEditSecondary(e.target.value)}
                                  autoFocus={editingCell.field === 'postcode'}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveCell(row)
                                    if (e.key === 'Escape') cancelEdit()
                                  }}
                                />
                              </div>
                              <CellEditorFooter onCancel={cancelEdit} onSave={() => saveCell(row)} />
                            </ActiveCellEditor>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span
                                onClick={() => startEdit(row, 'address')}
                                className={cellClass(hasProb('location'), ['address', 'postcode'])}
                                title="Click to edit address"
                              >
                                {justSaved?.id === row.business_id && justSaved.field === 'address' ? (
                                  <span className="inline-flex items-center gap-1.5 text-slate-900 font-medium">
                                    <CheckCircle2 size={13} strokeWidth={2.5} className="text-emerald-600 shrink-0 motion-check-pop" />
                                    {row.address}
                                  </span>
                                ) : (
                                  row.address || (row.branches?.length ? `${row.branches.length} branches` : <i className="text-slate-400">No address</i>)
                                )}
                              </span>
                              <span
                                onClick={() => startEdit(row, 'postcode')}
                                className={cellClass(hasProb('postcode'), ['postcode'])}
                                title="Click to edit postcode"
                              >
                                {justSaved?.id === row.business_id && justSaved.field === 'postcode' ? (
                                  <span className="inline-flex items-center gap-1.5 text-slate-900 font-medium">
                                    <CheckCircle2 size={13} strokeWidth={2.5} className="text-emerald-600 shrink-0 motion-check-pop" />
                                    {row.postcode}
                                  </span>
                                ) : (
                                  row.postcode || <i className="text-slate-400">Postcode</i>
                                )}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 6. Owner name */}
                        <td className="max-w-[180px]">
                          {editingCell?.id === row.business_id && editingCell.field === 'owner_name' ? (
                            <ActiveCellEditor shake={!!cellError} onCancel={cancelEdit} onSave={() => saveCell(row)} className="min-w-[180px]">
                              <div>
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Owner Name</span>
                                <input
                                  className="input !py-1 text-xs w-full"
                                  autoFocus
                                  placeholder="Owner / Manager name"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveCell(row)
                                    if (e.key === 'Escape') cancelEdit()
                                  }}
                                />
                              </div>
                              <CellEditorFooter onCancel={cancelEdit} onSave={() => saveCell(row)} />
                            </ActiveCellEditor>
                          ) : (
                            <div
                              onClick={() => startEdit(row, 'owner_name')}
                              className={cellClass(hasProb('owner_name'), ['owner_name'])}
                              title="Click to edit owner name"
                            >
                              {justSaved?.id === row.business_id && justSaved.field === 'owner_name' ? (
                                <span className="inline-flex items-center gap-1.5 text-slate-900 font-medium">
                                  <CheckCircle2 size={13} strokeWidth={2.5} className="text-emerald-600 shrink-0 motion-check-pop" />
                                  {row.contact_name}
                                </span>
                              ) : (
                                row.contact_name || <i className="text-slate-400">Missing</i>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 7. Owner contact */}
                        <td className="max-w-[200px]">
                          {editingCell?.id === row.business_id && editingCell.field === 'owner_contact' ? (
                            <ActiveCellEditor shake={!!cellError} onCancel={cancelEdit} onSave={() => saveCell(row)} className="min-w-[220px]">
                              <div>
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Owner Contact</span>
                                <input
                                  className="input !py-1 text-xs w-full"
                                  placeholder="Email, WhatsApp, LinkedIn or socials"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  autoFocus
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveCell(row)
                                    if (e.key === 'Escape') cancelEdit()
                                  }}
                                />
                              </div>
                              <CellEditorFooter onCancel={cancelEdit} onSave={() => saveCell(row)} />
                            </ActiveCellEditor>
                          ) : (
                            <div
                              onClick={() => startEdit(row, 'owner_contact')}
                              className={cellClass(hasProb('owner_contact'), ['owner_contact'])}
                              title="Click to edit owner contact"
                            >
                              {justSaved?.id === row.business_id && justSaved.field === 'owner_contact' ? (
                                <span className="inline-flex items-center gap-1.5 text-slate-900 font-medium">
                                  <CheckCircle2 size={13} strokeWidth={2.5} className="text-emerald-600 shrink-0 motion-check-pop" />
                                  {row.owner_contact || row.owner_email}
                                </span>
                              ) : (
                                row.owner_contact || row.owner_email || (
                                  <i className="text-slate-400">Missing</i>
                                )
                              )}
                            </div>
                          )}
                        </td>

                        {/* 8. Business contact */}
                        <td className="max-w-[200px]">
                          {editingCell?.id === row.business_id && editingCell.field === 'business_contact' ? (
                            <ActiveCellEditor shake={!!cellError} onCancel={cancelEdit} onSave={() => saveCell(row)} className="min-w-[200px]">
                              <div>
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Business Email</span>
                                <input
                                  className="input !py-1 text-xs w-full"
                                  placeholder="info@company.com"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  autoFocus
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveCell(row)
                                    if (e.key === 'Escape') cancelEdit()
                                  }}
                                />
                              </div>
                              <div>
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Business WhatsApp</span>
                                <input
                                  className="input !py-1 text-xs w-full"
                                  placeholder="07... or +44..."
                                  value={editSecondary}
                                  onChange={e => setEditSecondary(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveCell(row)
                                    if (e.key === 'Escape') cancelEdit()
                                  }}
                                />
                              </div>
                              <CellEditorFooter onCancel={cancelEdit} onSave={() => saveCell(row)} />
                            </ActiveCellEditor>
                          ) : (
                            <div
                              onClick={() => startEdit(row, 'business_contact')}
                              className={cellClass(hasProb('business_contact'), ['business_contact'])}
                              title="Click to edit business contact"
                            >
                              {justSaved?.id === row.business_id && justSaved.field === 'business_contact' ? (
                                <span className="inline-flex items-center gap-1.5 text-slate-900 font-medium">
                                  <CheckCircle2 size={13} strokeWidth={2.5} className="text-emerald-600 shrink-0 motion-check-pop" />
                                  {row.email || row.whatsapp_number}
                                </span>
                              ) : (
                                row.email || row.whatsapp_number || row.instagram || row.facebook || (
                                  <i className="text-slate-400">Missing</i>
                                )
                              )}
                            </div>
                          )}
                        </td>

                        {/* 9. Tech partner */}
                        <td className="max-w-[260px]">
                          {editingCell?.id === row.business_id && editingCell.field === 'tech_partner' ? (
                            <ActiveCellEditor shake={!!cellError} onCancel={cancelEdit} onSave={() => saveCell(row)} className="min-w-[240px]">
                              <div>
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Existing Tech Partner</span>
                                <input
                                  className="input !py-1 text-xs w-full"
                                  placeholder="Agency (name it), DIY (tool e.g. Wix), or None"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  autoFocus
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveCell(row)
                                    if (e.key === 'Escape') cancelEdit()
                                  }}
                                />
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                                <span className="text-slate-400">Quick pick:</span>
                                <button
                                  type="button"
                                  className="font-semibold text-primary hover:opacity-75 transition-opacity"
                                  onClick={() => setEditValue('None')}
                                >
                                  None
                                </button>
                                <span>·</span>
                                <button
                                  type="button"
                                  className="font-semibold text-primary hover:opacity-75 transition-opacity"
                                  onClick={() => setEditValue('DIY (Wix)')}
                                >
                                  DIY (Wix)
                                </button>
                                <span>·</span>
                                <button
                                  type="button"
                                  className="font-semibold text-primary hover:opacity-75 transition-opacity"
                                  onClick={() => setEditValue('Agency')}
                                >
                                  Agency
                                </button>
                              </div>
                              <CellEditorFooter onCancel={cancelEdit} onSave={() => saveCell(row)} />
                            </ActiveCellEditor>
                          ) : (
                            <div
                              onClick={() => startEdit(row, 'tech_partner')}
                              className={cellClass(hasProb('tech_partner'), ['tech_partner'])}
                              title="Click to edit tech partner"
                            >
                              {justSaved?.id === row.business_id && justSaved.field === 'tech_partner' ? (
                                <span className="inline-flex items-center gap-1.5 text-slate-900 font-medium">
                                  <CheckCircle2 size={13} strokeWidth={2.5} className="text-emerald-600 shrink-0 motion-check-pop" />
                                  {row.tech_partner_type === 'None'
                                    ? 'None'
                                    : row.tech_partner_type
                                    ? `${row.tech_partner_type} (${row.tech_partner_name || '?'})`
                                    : 'Saved'}
                                </span>
                              ) : (
                                row.tech_partner_type === 'None'
                                  ? 'None'
                                  : row.tech_partner_type
                                  ? `${row.tech_partner_type} (${row.tech_partner_name || '?'})`
                                  : <i className="text-slate-400">Missing</i>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 10. Gaps found */}
                        <td className="max-w-[220px]">
                          {editingCell?.id === row.business_id && editingCell.field === 'gaps' ? (
                            <ActiveCellEditor shake={!!cellError} onCancel={cancelEdit} onSave={() => saveCell(row)} className="min-w-[220px]">
                              <div>
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Gaps Found</span>
                                  <button
                                    type="button"
                                    onClick={() => setEditValue('None')}
                                    className="text-[10px] font-medium text-primary hover:opacity-75 transition-opacity underline"
                                  >
                                    Set "None"
                                  </button>
                                </div>
                                <textarea
                                  className="input !py-1 text-xs w-full min-h-[50px] resize-none"
                                  autoFocus
                                  placeholder="e.g. No direct booking, or leave empty for None"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault()
                                      saveCell(row)
                                    }
                                    if (e.key === 'Escape') cancelEdit()
                                  }}
                                />
                              </div>
                              <CellEditorFooter onCancel={cancelEdit} onSave={() => saveCell(row)} />
                            </ActiveCellEditor>
                          ) : (
                            <div
                              onClick={() => startEdit(row, 'gaps')}
                              className={cellClass(hasProb('gaps'), ['gaps'])}
                              title="Click to edit gaps found"
                            >
                              {justSaved?.id === row.business_id && justSaved.field === 'gaps' ? (
                                <span className="inline-flex items-center gap-1.5 text-slate-900 font-medium">
                                  <CheckCircle2 size={13} strokeWidth={2.5} className="text-emerald-600 shrink-0 motion-check-pop" />
                                  {row.gaps_found || <i className="text-slate-400">Missing</i>}
                                </span>
                              ) : (
                                row.gaps_found || <i className="text-slate-400">Missing</i>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td>
                          {isRowSaving ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                              <ButtonSpinner size={11} className="text-amber-600" /> Saving...
                            </span>
                          ) : isReady ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 shadow-2xs">
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
          </div>

          {cellError && (
            <div key={cellError} role="alert" className="motion-error-in rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
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
      <Modal open={showBulkSet} onClose={() => setShowBulkSet(false)} locked={bulkActionBusy} title={`Set value for ${selected.length} leads`}>
        <div className="space-y-4">
          <div>
            <label className="label">Field to set</label>
            <select
              className="input"
              value={bulkField}
              onChange={e => {
                const f = e.target.value as any
                setBulkField(f)
                if (f === 'category') setBulkVal(lists.categories[0]?.name ?? '')
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
                {categoryNames(lists).map(c => (
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
                {lists.services.map(s => {
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
            <button className="btn btn-secondary" onClick={() => setShowBulkSet(false)} disabled={bulkActionBusy}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={bulkActionBusy} onClick={handleBulkSet}>
              {bulkActionBusy && <Spinner />} {bulkActionBusy ? 'Applying…' : `Apply to ${selected.length} leads`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        locked={bulkActionBusy}
        title={`Delete ${selected.length} leads?`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete {selected.length} leads? They will be removed permanently.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)} disabled={bulkActionBusy}>
              Cancel
            </button>
            <button className="btn btn-primary !bg-rose-600 hover:!bg-rose-700" disabled={bulkActionBusy} onClick={handleDelete}>
              {bulkActionBusy && <Spinner />} {bulkActionBusy ? 'Deleting…' : 'Delete permanently'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
