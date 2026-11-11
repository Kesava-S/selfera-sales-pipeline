'use client'

import { useMemo, useState } from 'react'
import {
  Download,
  CheckCircle2,
  FileSpreadsheet,
  Phone,
  Mail,
  MessageSquare,
} from 'lucide-react'
import { Modal, Spinner, toast, ErrorNote } from '@/components/ui'
import type { PitchRow } from '@/components/v2/LeadsManagement'

export interface ColumnDefinition {
  key: string
  label: string
  group: 'Primary' | 'Contact' | 'Pipeline' | 'Additional'
  default: boolean
  description?: string
  accessor: (row: PitchRow) => string | number | null | undefined
}

export const EXPORTABLE_COLUMNS: ColumnDefinition[] = [
  // Primary
  {
    key: 'business_name',
    label: 'Business Name',
    group: 'Primary',
    default: true,
    description: 'Trading name of the business',
    accessor: r => r.business_name,
  },
  {
    key: 'business_type',
    label: 'Category',
    group: 'Primary',
    default: true,
    description: 'Industry or vertical',
    accessor: r => r.business_type,
  },
  {
    key: 'area',
    label: 'Area / City',
    group: 'Primary',
    default: true,
    description: 'Town, borough, or city',
    accessor: r => r.area,
  },
  {
    key: 'postcode',
    label: 'Postcode',
    group: 'Primary',
    default: true,
    description: 'Postal code location',
    accessor: r => r.postcode,
  },
  {
    key: 'address',
    label: 'Full Address',
    group: 'Primary',
    default: false,
    description: 'Street address line',
    accessor: r => r.address,
  },
  {
    key: 'company_type',
    label: 'Company Type',
    group: 'Primary',
    default: true,
    description: 'LTD, Sole Trader, LLP, etc.',
    accessor: r => r.company_type,
  },
  {
    key: 'existing_website',
    label: 'Website',
    group: 'Primary',
    default: false,
    description: 'Current business website URL',
    accessor: r => r.existing_website || (r.has_no_website ? 'No website' : null),
  },

  // Contact Details
  {
    key: 'contact_name',
    label: 'Contact Name',
    group: 'Contact',
    default: true,
    description: 'Key contact or decision maker',
    accessor: r => r.contact_name,
  },
  {
    key: 'email',
    label: 'Email',
    group: 'Contact',
    default: true,
    description: 'Primary contact email address',
    accessor: r => r.email || r.owner_email,
  },
  {
    key: 'whatsapp_number',
    label: 'WhatsApp Number',
    group: 'Contact',
    default: true,
    description: 'Primary verified mobile/WhatsApp number',
    accessor: r => r.whatsapp_number,
  },
  {
    key: 'phone',
    label: 'Secondary Phone',
    group: 'Contact',
    default: false,
    description: 'Secondary landline or owner phone number',
    accessor: r => r.phone || r.owner_contact,
  },
  {
    key: 'instagram',
    label: 'Instagram',
    group: 'Contact',
    default: true,
    description: 'Instagram handle or profile link',
    accessor: r => r.instagram,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    group: 'Contact',
    default: true,
    description: 'Facebook page or handle',
    accessor: r => r.facebook,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    group: 'Contact',
    default: true,
    description: 'LinkedIn company or personal page',
    accessor: r => r.linkedin,
  },

  // Pipeline & Outreach
  {
    key: 'stage',
    label: 'Stage',
    group: 'Pipeline',
    default: true,
    description: 'Current sales pipeline stage',
    accessor: r => r.stage,
  },
  {
    key: 'services_pitched',
    label: 'Services Pitched',
    group: 'Pipeline',
    default: true,
    description: 'Services offered to the lead',
    accessor: r => (r.services_pitched && r.services_pitched.length ? r.services_pitched.join('; ') : null),
  },
  {
    key: 'services_won',
    label: 'Services Won',
    group: 'Pipeline',
    default: true,
    description: 'Contracted or closed services',
    accessor: r => (r.services_won && r.services_won.length ? r.services_won.join('; ') : null),
  },
  {
    key: 'assigned_to',
    label: 'Assigned Sales',
    group: 'Pipeline',
    default: true,
    description: 'Assigned salesperson name',
    accessor: r => r.assigned_sales_name,
  },
  {
    key: 'consultant',
    label: 'Consultant',
    group: 'Pipeline',
    default: true,
    description: 'Assigned technical consultant name',
    accessor: r => r.assigned_consultant_name,
  },
  {
    key: 'platforms',
    label: 'Platform Outreach',
    group: 'Pipeline',
    default: true,
    description: 'Active thread status across platforms',
    accessor: r =>
      r.threads && r.threads.length
        ? r.threads.map(t => `${t.platform}: ${t.status}`).join('; ')
        : null,
  },
  {
    key: 'next_due',
    label: 'Next Due Date',
    group: 'Pipeline',
    default: true,
    description: 'Scheduled follow-up date',
    accessor: r => r.next_due_on,
  },
  {
    key: 'archived',
    label: 'Archived',
    group: 'Pipeline',
    default: true,
    description: 'Whether the opportunity is archived',
    accessor: r => (r.archived ? 'yes' : 'no'),
  },
  {
    key: 'added_on',
    label: 'Date Added',
    group: 'Pipeline',
    default: true,
    description: 'Record creation date',
    accessor: r => (r.created_at ? r.created_at.slice(0, 10) : null),
  },

  // Additional Info
  {
    key: 'tech_partner_name',
    label: 'Tech Partner',
    group: 'Additional',
    default: false,
    description: 'Existing software provider or POS vendor',
    accessor: r => r.tech_partner_name,
  },
  {
    key: 'gaps_found',
    label: 'Gaps Found',
    group: 'Additional',
    default: false,
    description: 'Audit findings and identified weaknesses',
    accessor: r => r.gaps_found,
  },
]

const DEFAULT_KEYS = EXPORTABLE_COLUMNS.filter(c => c.default).map(c => c.key)

export function LeadExportModal({
  open,
  onClose,
  totalMatching,
  selectedIds,
  rows,
  params,
  tab,
}: {
  open: boolean
  onClose: () => void
  totalMatching: number
  selectedIds: string[]
  rows: PitchRow[]
  params: Record<string, string | undefined>
  tab: string
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [selectedColumns, setSelectedColumns] = useState<string[]>(DEFAULT_KEYS)
  const [scope, setScope] = useState<'selected' | 'all'>(selectedIds.length > 0 ? 'selected' : 'all')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [progressPercent, setProgressPercent] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [exportDate, setExportDate] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filename, setFilename] = useState(() => {
    const date = new Date().toISOString().slice(0, 10)
    return `selfera-leads-${date}.csv`
  })

  const reset = () => {
    setStep(1)
    setSelectedColumns(DEFAULT_KEYS)
    setScope(selectedIds.length > 0 ? 'selected' : 'all')
    setBusy(false)
    setProgress('')
    setProgressPercent(0)
    setIsComplete(false)
    setExportDate(null)
    setError(null)
  }

  const close = () => {
    if (busy) {
      toast.warning('Please wait until the export completes.')
      return
    }
    reset()
    onClose()
  }

  // Quick actions
  const selectAll = () => setSelectedColumns(EXPORTABLE_COLUMNS.map(c => c.key))
  const deselectAll = () => setSelectedColumns([])
  const resetDefaults = () => setSelectedColumns(DEFAULT_KEYS)

  const toggleColumn = (key: string) => {
    setSelectedColumns(curr =>
      curr.includes(key) ? curr.filter(k => k !== key) : [...curr, key]
    )
  }

  // Sample values map for Step 2
  const sampleMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const col of EXPORTABLE_COLUMNS) {
      for (const r of rows) {
        const val = col.accessor(r)
        if (val != null && String(val).trim().length > 0) {
          const str = String(val).trim()
          map.set(col.key, str.length > 25 ? `${str.slice(0, 25)}…` : str)
          break
        }
      }
    }
    return map
  }, [rows])

  // Count metrics for verified data
  const targetCount = scope === 'selected' ? selectedIds.length : totalMatching

  // Preview rows for Step 3
  const previewRows = useMemo(() => {
    if (scope === 'selected' && selectedIds.length > 0) {
      const filtered = rows.filter(r => selectedIds.includes(r.opportunity_id))
      return filtered.length ? filtered : rows.slice(0, 50)
    }
    return rows.slice(0, 50)
  }, [scope, selectedIds, rows])

  const activeStats = useMemo(() => {
    const base = scope === 'selected' && selectedIds.length > 0
      ? rows.filter(r => selectedIds.includes(r.opportunity_id))
      : rows

    const withWhatsApp = base.filter(r => Boolean(r.whatsapp_number)).length
    const withEmail = base.filter(r => Boolean(r.email || r.owner_email)).length
    const withCleanData = base.filter(r => Boolean(r.whatsapp_number || r.email || r.owner_email)).length
    const withBoth = base.filter(r => Boolean(r.whatsapp_number && (r.email || r.owner_email))).length

    const baseLen = base.length || 1
    const whatsAppCount = Math.round((withWhatsApp / baseLen) * targetCount)
    const emailCount = Math.round((withEmail / baseLen) * targetCount)
    const cleanDataCount = Math.round((withCleanData / baseLen) * targetCount)
    const bothCount = Math.round((withBoth / baseLen) * targetCount)
    const cleanPercent = targetCount > 0 ? Math.round((cleanDataCount / targetCount) * 100) : 0
    const whatsAppPercent = targetCount > 0 ? Math.round((whatsAppCount / targetCount) * 100) : 0
    const emailPercent = targetCount > 0 ? Math.round((emailCount / targetCount) * 100) : 0

    return {
      whatsAppCount,
      whatsAppPercent,
      emailCount,
      emailPercent,
      cleanDataCount,
      cleanPercent,
      bothCount,
      // backward compatibility
      phoneCount: whatsAppCount,
      phonePercent: whatsAppPercent,
    }
  }, [scope, selectedIds, rows, targetCount])

  const verifiedColumnsList = useMemo(() => {
    return EXPORTABLE_COLUMNS.filter(c => selectedColumns.includes(c.key))
  }, [selectedColumns])

  // Group columns by category for Step 2
  const groupedColumns = useMemo(() => {
    return {
      'Primary Business Details': EXPORTABLE_COLUMNS.filter(c => c.group === 'Primary'),
      'Contact Information': EXPORTABLE_COLUMNS.filter(c => c.group === 'Contact'),
      'Pipeline & Outreach': EXPORTABLE_COLUMNS.filter(c => c.group === 'Pipeline'),
      'Additional Information': EXPORTABLE_COLUMNS.filter(c => c.group === 'Additional'),
    }
  }, [])

  // Execute CSV Export
  const startExport = async () => {
    if (!selectedColumns.length) {
      toast.warning('Please select at least one column to export.')
      return
    }

    setBusy(true)
    setError(null)
    setIsComplete(false)
    setStep(4)
    setProgressPercent(20)
    setProgress('Preparing export data...')

    try {
      const payload: Record<string, any> = {
        columns: selectedColumns,
        filename: filename.endsWith('.csv') ? filename : `${filename}.csv`,
      }

      if (scope === 'selected' && selectedIds.length > 0) {
        payload.ids = selectedIds
      } else {
        payload.tab = tab
        if (params.service) payload.service = params.service
        if (params.type) payload.type = params.type
        if (params.stage) payload.stage = params.stage
        if (params.q) payload.q = params.q
        if (params.platform) payload.platform = params.platform
        if (params.assigned) payload.assigned = params.assigned
        if (params.archived) payload.archived = params.archived === '1'
      }

      setProgressPercent(45)
      setProgress('Fetching records from database...')

      const res = await fetch('/api/leads/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: 'Export failed' }))
        throw new Error(errJson.error || 'Failed to download export')
      }

      setProgressPercent(75)
      setProgress('Generating CSV file...')

      const blob = await res.blob()

      setProgressPercent(95)
      setProgress('Triggering download...')

      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = payload.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)

      setProgressPercent(100)
      await new Promise(r => setTimeout(r, 400))

      setExportDate(new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }))
      setIsComplete(true)
      toast.success(`Successfully exported ${targetCount.toLocaleString('en-GB')} leads to CSV.`)
    } catch (err: any) {
      console.error('Export error:', err)
      setError(err?.message || 'Export failed. Please try again.')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  // 4 steps mirroring CsvImportModal: ['Upload', 'Match columns', 'Check', 'Import']
  const STEPS = ['Select data', 'Verify columns', 'Check', 'Export']

  return (
    <Modal open={open} onClose={close} locked={busy} title="Export leads to CSV" wide>
      {/* Stepper Header (likewise import CSV modal) */}
      <ol className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        {STEPS.map((s, i) => {
          const stepNum = i + 1
          const isActive = step === stepNum
          const isDone = step > stepNum || (step === 4 && isComplete)
          return (
            <li
              key={s}
              className={`flex items-center gap-2 rounded-full px-3 py-1 font-semibold transition-colors ${
                isActive && !isComplete
                  ? 'bg-primary text-white shadow-sm'
                  : isDone
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold">
                {isDone ? <CheckCircle2 size={14} /> : stepNum}
              </span>
              <span>{s}</span>
            </li>
          )
        })}
      </ol>

      {/* ================= STEP 1: SELECT DATA ================= */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            <div>
              <b>Lead Management</b>: {totalMatching.toLocaleString('en-GB')} rows match current filters
              {selectedIds.length > 0 && ` (${selectedIds.length} currently selected)`}.
            </div>
            <div className="text-xs text-slate-500">
              Tab: <span className="font-semibold text-slate-700">{tab}</span>
              {params.stage && ` · Stage: ${params.stage}`}
              {params.type && ` · Type: ${params.type}`}
            </div>
          </div>

          <p className="text-sm text-slate-600">
            Choose whether to export only the rows you selected with checkboxes, or all leads matching your current filters.
          </p>

          {/* Scope selection card */}
          {selectedIds.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all ${
                  scope === 'selected'
                    ? 'border-primary bg-primary-bg/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  className="mt-0.5 text-primary"
                  checked={scope === 'selected'}
                  onChange={() => setScope('selected')}
                />
                <div>
                  <div className="font-semibold text-slate-900 text-sm">
                    Selected leads only ({selectedIds.length.toLocaleString('en-GB')})
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Exports only the specific leads currently ticked with checkboxes on the table.
                  </p>
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all ${
                  scope === 'all'
                    ? 'border-primary bg-primary-bg/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  className="mt-0.5 text-primary"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                />
                <div>
                  <div className="font-semibold text-slate-900 text-sm">
                    All matching leads ({totalMatching.toLocaleString('en-GB')})
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Exports all records matching active filters across all pages.
                  </p>
                </div>
              </label>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                <FileSpreadsheet size={18} className="text-primary" />
                <span>Exporting all {totalMatching.toLocaleString('en-GB')} leads matching filters</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                All records matching current filters ({tab} tab) will be included in the export.
              </p>
            </div>
          )}

          {/* Filename Input */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <label className="label mb-1.5">Export CSV file name</label>
            <input
              type="text"
              className="input text-sm"
              value={filename}
              onChange={e => setFilename(e.target.value)}
              placeholder="selfera-leads.csv"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              The file will download automatically as an RFC 4180 CSV spreadsheet.
            </p>
          </div>

          <ErrorNote error={error} />

          {/* Step 1 Actions */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <button className="btn btn-secondary" onClick={close}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={targetCount === 0}
              onClick={() => setStep(2)}
            >
              Next: Verify columns
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 2: VERIFY COLUMNS ================= */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            <div>
              <b>{selectedColumns.length}</b> of <b>{EXPORTABLE_COLUMNS.length}</b> columns selected.
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button className="font-semibold text-primary hover:text-primary-hover" onClick={selectAll}>
                Select all
              </button>
              <span className="text-slate-300">·</span>
              <button className="font-semibold text-primary hover:text-primary-hover" onClick={deselectAll}>
                Clear all
              </button>
              <span className="text-slate-300">·</span>
              <button className="font-semibold text-primary hover:text-primary-hover" onClick={resetDefaults}>
                Default columns
              </button>
            </div>
          </div>

          <p className="text-sm text-slate-600">
            Verify each field you want to include in the exported CSV. Unchecked columns will be omitted from the download.
          </p>

          {/* Grouped Columns Selection (flows smoothly without inner scroll) */}
          <div className="space-y-4">
            {Object.entries(groupedColumns).map(([groupTitle, cols]) => (
              <div key={groupTitle} className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1 text-xs font-bold uppercase tracking-wider text-slate-600">
                  <span>{groupTitle}</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    {cols.filter(c => selectedColumns.includes(c.key)).length} of {cols.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {cols.map(c => {
                    const isChecked = selectedColumns.includes(c.key)
                    const sample = sampleMap.get(c.key)
                    return (
                      <label
                        key={c.key}
                        className={`flex cursor-pointer select-none items-start gap-2.5 rounded-xl border p-2.5 transition-all ${
                          isChecked
                            ? 'border-primary/40 bg-primary-bg/25 text-slate-900 shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded text-primary focus:ring-primary"
                          checked={isChecked}
                          onChange={() => toggleColumn(c.key)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-sm font-semibold truncate leading-snug">
                              {c.label}
                            </span>
                            {c.default && (
                              <span className="text-[10px] font-medium text-primary shrink-0">
                                default
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[11px] text-slate-400 block truncate">
                            {c.key}
                          </span>
                          {sample && (
                            <span className="mt-1 block truncate text-[11px] text-slate-500 italic">
                              e.g. &ldquo;{sample}&rdquo;
                            </span>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <ErrorNote error={error} />

          {/* Step 2 Actions */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <button className="btn btn-secondary" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              className="btn btn-primary"
              disabled={selectedColumns.length === 0}
              onClick={() => setStep(3)}
            >
              Next: Check & preview
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 3: CHECK & PREVIEW ================= */}
      {step === 3 && (
        <div className="space-y-5">
          {/* 4 Summary Boxes (exact CsvImportModal style) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Box 1: To Export */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 text-center">
              <div className="text-2xl font-bold text-emerald-800">
                {targetCount.toLocaleString('en-GB')}
              </div>
              <div className="text-xs font-semibold text-emerald-900">To Export</div>
              <div className="mt-1 text-[11px] text-emerald-700">
                {scope === 'selected' ? 'Selected rows' : 'Matching leads'}
              </div>
            </div>

            {/* Box 2: WhatsApp Ready */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 text-center">
              <div className="text-2xl font-bold text-blue-800">
                {activeStats.phoneCount.toLocaleString('en-GB')}
              </div>
              <div className="text-xs font-semibold text-blue-900">With WhatsApp</div>
              <div className="mt-1 text-[11px] text-blue-700">
                ~{activeStats.phonePercent}% reachable
              </div>
            </div>

            {/* Box 3: With Email */}
            <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3.5 text-center">
              <div className="text-2xl font-bold text-purple-800">
                {activeStats.emailCount.toLocaleString('en-GB')}
              </div>
              <div className="text-xs font-semibold text-purple-900">With Email</div>
              <div className="mt-1 text-[11px] text-purple-700">
                ~{activeStats.emailPercent}% with email
              </div>
            </div>

            {/* Box 4: Verified Columns */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 text-center">
              <div className="text-2xl font-bold text-amber-800">{selectedColumns.length}</div>
              <div className="text-xs font-semibold text-amber-900">Verified columns</div>
              <div className="mt-1 text-[11px] text-amber-700">Fields in CSV</div>
            </div>
          </div>

          {/* Leads Preview Table (using exact table-wrap and table text-xs) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Preview of leads to export (showing up to {previewRows.length} rows):</span>
              <span>
                {targetCount.toLocaleString('en-GB')} total lead{targetCount === 1 ? '' : 's'} will be exported
              </span>
            </div>
            <div className="table-wrap max-h-72 overflow-y-auto">
              <table className="table text-xs">
                <thead>
                  <tr>
                    <th className="w-10 text-center">Row</th>
                    {verifiedColumnsList.map(c => (
                      <th key={c.key} className="whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, idx) => (
                    <tr key={r.opportunity_id || idx}>
                      <td className="text-slate-500 text-center">{idx + 1}</td>
                      {verifiedColumnsList.map(c => {
                        const val = c.accessor(r)
                        const isNull = val == null || String(val).trim() === ''
                        return (
                          <td
                            key={c.key}
                            className={`max-w-xs truncate ${
                              isNull ? 'text-slate-400 italic text-[11px]' : ''
                            }`}
                          >
                            {isNull ? 'None' : String(val)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Contact & Clean Data Detection Metrics (Bottom Summary) */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-700">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mr-1">
                Contact channels:
              </span>
              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                Clean data: {activeStats.cleanDataCount} ({activeStats.cleanPercent}%)
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-teal-700">
                <MessageSquare size={13} className="text-teal-600 shrink-0" />
                WhatsApp: {activeStats.whatsAppCount}
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-sky-700">
                <Mail size={13} className="text-sky-600 shrink-0" />
                Email: {activeStats.emailCount}
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              Clean data = leads with at least one verified direct contact (WhatsApp or Email)
            </span>
          </div>

          <ErrorNote error={error} />

          {/* Step 3 Actions */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <button className="btn btn-secondary" onClick={() => setStep(2)}>
              Back
            </button>
            <button
              className="btn btn-primary"
              disabled={targetCount === 0 || selectedColumns.length === 0 || busy}
              onClick={startExport}
            >
              {busy && <Spinner />} Export {targetCount.toLocaleString('en-GB')} lead{targetCount === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 4: EXPORT PROGRESS & DETAILS ================= */}
      {step === 4 && (
        <div className="py-2">
          {busy ? (
            /* Clear, centered animated loading UI */
            <div className="py-10 space-y-5 text-center">
              <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <FileSpreadsheet size={22} className="text-primary" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  {progress || 'Exporting leads to CSV...'}
                </h3>
                <p className="text-xs text-slate-500">
                  Compiling {targetCount.toLocaleString('en-GB')} records with {selectedColumns.length} verified columns
                </p>
              </div>

              {/* Progress bar with percentage */}
              <div className="mx-auto w-full max-w-sm space-y-1.5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                  <span>{progressPercent}%</span>
                  <span>Preparing download...</span>
                </div>
              </div>

              <p className="text-xs text-slate-400">
                Please keep this window open while the export completes.
              </p>
            </div>
          ) : !error && isComplete ? (
            /* Export Complete: ONLY show the export details */
            <div className="space-y-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-center">
                <CheckCircle2 size={32} className="mx-auto text-emerald-600 mb-1.5" />
                <h3 className="text-base font-bold text-slate-900">Export complete</h3>
                <p className="text-xs text-slate-600">
                  Your CSV file has been generated and downloaded to your computer.
                </p>
              </div>

              {/* Export Details Only (clean key-value card) */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <FileSpreadsheet size={14} className="text-primary" />
                    Export Details
                  </h4>
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-500 font-medium">File name</span>
                    <span className="font-mono font-semibold text-slate-800">{filename}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-500 font-medium">Total records</span>
                    <span className="font-semibold text-slate-900">{targetCount.toLocaleString('en-GB')} leads</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-500 font-medium">Verified columns</span>
                    <span className="font-semibold text-slate-900">{selectedColumns.length} columns included</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-500 font-medium">Data scope</span>
                    <span className="font-medium text-slate-700">
                      {scope === 'selected' ? `Selected leads only (${selectedIds.length})` : `All matching leads (${totalMatching})`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-500 font-medium">Format</span>
                    <span className="font-medium text-slate-700">CSV (RFC 4180, UTF-8)</span>
                  </div>
                  {exportDate && (
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-slate-500 font-medium">Exported at</span>
                      <span className="font-medium text-slate-700">{exportDate}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Clean Footer Actions: Download again & Done */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className="btn btn-secondary text-xs"
                  onClick={startExport}
                >
                  <Download size={14} /> Download again
                </button>
                <button
                  type="button"
                  className="btn btn-primary px-6 text-xs"
                  onClick={close}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <ErrorNote error={error || 'An unexpected error occurred during export.'} />
              <div className="flex justify-end gap-2">
                <button className="btn btn-secondary" onClick={() => setStep(3)}>
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
