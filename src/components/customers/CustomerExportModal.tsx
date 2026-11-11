'use client'

import { useMemo, useState } from 'react'
import {
  Download,
  CheckCircle2,
  FileSpreadsheet,
  Phone,
  Mail,
} from 'lucide-react'
import { Modal, Spinner, toast, ErrorNote } from '@/components/ui'
import type { CustomerLead } from '@/lib/customerLeads'

export interface AudienceColumnDefinition {
  key: string
  label: string
  group: 'Contact' | 'Location' | 'Activity' | 'Consent'
  default: boolean
  accessor: (row: CustomerLead) => string | number | null | undefined
}

export const AUDIENCE_EXPORT_COLUMNS: AudienceColumnDefinition[] = [
  // Contact
  {
    key: 'first_name',
    label: 'First Name',
    group: 'Contact',
    default: true,
    accessor: r => r.first_name,
  },
  {
    key: 'last_name',
    label: 'Last Name',
    group: 'Contact',
    default: true,
    accessor: r => r.last_name,
  },
  {
    key: 'email',
    label: 'Email',
    group: 'Contact',
    default: true,
    accessor: r => r.email,
  },
  {
    key: 'phone',
    label: 'Primary Phone',
    group: 'Contact',
    default: true,
    accessor: r => r.phone_e164 || r.phone,
  },
  {
    key: 'phone_type',
    label: 'Phone Type',
    group: 'Contact',
    default: true,
    accessor: r => r.phone_type,
  },
  {
    key: 'second_phone',
    label: 'Second Phone',
    group: 'Contact',
    default: false,
    accessor: r => r.phone2_e164 || r.phone2,
  },
  {
    key: 'second_phone_type',
    label: 'Second Phone Type',
    group: 'Contact',
    default: false,
    accessor: r => r.phone2_type,
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp Status',
    group: 'Contact',
    default: true,
    accessor: r => r.whatsapp_status,
  },

  // Location
  {
    key: 'country',
    label: 'Country',
    group: 'Location',
    default: true,
    accessor: r => r.country,
  },
  {
    key: 'town',
    label: 'Town / City',
    group: 'Location',
    default: true,
    accessor: r => r.town,
  },
  {
    key: 'postcode',
    label: 'Postcode',
    group: 'Location',
    default: true,
    accessor: r => r.postcode,
  },

  // Activity & Purchases
  {
    key: 'last_visit',
    label: 'Last Visit Date',
    group: 'Activity',
    default: true,
    accessor: r => r.last_purchase_on,
  },
  {
    key: 'purchased',
    label: 'Purchase History',
    group: 'Activity',
    default: true,
    accessor: r => r.purchased,
  },
  {
    key: 'birthday_month',
    label: 'Birthday Month',
    group: 'Activity',
    default: false,
    accessor: r => (r.birthday_month ? `Month ${r.birthday_month}` : null),
  },
  {
    key: 'tags',
    label: 'Tags',
    group: 'Activity',
    default: true,
    accessor: r => (r.tags && r.tags.length ? r.tags.join('; ') : null),
  },
  {
    key: 'notes',
    label: 'Notes',
    group: 'Activity',
    default: false,
    accessor: r => r.notes,
  },

  // Consent & Compliance
  {
    key: 'consent_confirmed',
    label: 'Consent Confirmed',
    group: 'Consent',
    default: true,
    accessor: r => (r.consent_confirmed ? 'yes' : 'no'),
  },
  {
    key: 'consent_confirmed_on',
    label: 'Consent Date',
    group: 'Consent',
    default: true,
    accessor: r => (r.consent_confirmed_at ? r.consent_confirmed_at.slice(0, 10) : null),
  },
  {
    key: 'do_not_contact',
    label: 'Do Not Contact',
    group: 'Consent',
    default: true,
    accessor: r => (r.do_not_contact ? 'yes' : 'no'),
  },
  {
    key: 'do_not_contact_reason',
    label: 'DNC Reason',
    group: 'Consent',
    default: false,
    accessor: r => r.do_not_contact_reason,
  },
  {
    key: 'source',
    label: 'Source',
    group: 'Consent',
    default: true,
    accessor: r => r.source,
  },
  {
    key: 'added_on',
    label: 'Date Added',
    group: 'Consent',
    default: true,
    accessor: r => (r.created_at ? r.created_at.slice(0, 10) : null),
  },
]

const DEFAULT_KEYS = AUDIENCE_EXPORT_COLUMNS.filter(c => c.default).map(c => c.key)

export function CustomerExportModal({
  open,
  onClose,
  business,
  customers,
  selectedIds,
  totalMatching,
  filters,
}: {
  open: boolean
  onClose: () => void
  business: { id: string; business_name: string }
  customers: CustomerLead[]
  selectedIds: string[]
  totalMatching: number
  filters: { tab?: string; q?: string; phone?: string; country?: string }
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
    const slug =
      business.business_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'client'
    const date = new Date().toISOString().slice(0, 10)
    return `${slug}-audience-${date}.csv`
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

  const selectAll = () => setSelectedColumns(AUDIENCE_EXPORT_COLUMNS.map(c => c.key))
  const deselectAll = () => setSelectedColumns([])
  const resetDefaults = () => setSelectedColumns(DEFAULT_KEYS)

  const toggleColumn = (key: string) => {
    setSelectedColumns(curr =>
      curr.includes(key) ? curr.filter(k => k !== key) : [...curr, key]
    )
  }

  const sampleMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const col of AUDIENCE_EXPORT_COLUMNS) {
      for (const r of customers) {
        const val = col.accessor(r)
        if (val != null && String(val).trim().length > 0) {
          const str = String(val).trim()
          map.set(col.key, str.length > 25 ? `${str.slice(0, 25)}…` : str)
          break
        }
      }
    }
    return map
  }, [customers])

  const targetCount = scope === 'selected' ? selectedIds.length : totalMatching

  const previewRows = useMemo(() => {
    if (scope === 'selected' && selectedIds.length > 0) {
      const filtered = customers.filter(c => selectedIds.includes(c.id))
      return filtered.length ? filtered : customers.slice(0, 50)
    }
    return customers.slice(0, 50)
  }, [scope, selectedIds, customers])

  const activeStats = useMemo(() => {
    const base =
      scope === 'selected' && selectedIds.length > 0
        ? customers.filter(c => selectedIds.includes(c.id))
        : customers

    const withPhone = base.filter(c => Boolean(c.phone_e164 || c.phone)).length
    const withEmail = base.filter(c => Boolean(c.email)).length
    const withCleanData = base.filter(c => Boolean(c.phone_e164 || c.phone || c.email)).length
    const withBoth = base.filter(c => Boolean((c.phone_e164 || c.phone) && c.email)).length

    const baseLen = base.length || 1
    const phoneCount = Math.round((withPhone / baseLen) * targetCount)
    const emailCount = Math.round((withEmail / baseLen) * targetCount)
    const cleanDataCount = Math.round((withCleanData / baseLen) * targetCount)
    const bothCount = Math.round((withBoth / baseLen) * targetCount)
    const cleanPercent = targetCount > 0 ? Math.round((cleanDataCount / targetCount) * 100) : 0

    return {
      phoneCount,
      phonePercent: Math.round((withPhone / baseLen) * 100),
      emailCount,
      emailPercent: Math.round((withEmail / baseLen) * 100),
      cleanDataCount,
      cleanPercent,
      bothCount,
    }
  }, [scope, selectedIds, customers, targetCount])

  const verifiedColumnsList = useMemo(() => {
    return AUDIENCE_EXPORT_COLUMNS.filter(c => selectedColumns.includes(c.key))
  }, [selectedColumns])

  const groupedColumns = useMemo(() => {
    return {
      'Contact Details': AUDIENCE_EXPORT_COLUMNS.filter(c => c.group === 'Contact'),
      'Location': AUDIENCE_EXPORT_COLUMNS.filter(c => c.group === 'Location'),
      'Activity & Purchases': AUDIENCE_EXPORT_COLUMNS.filter(c => c.group === 'Activity'),
      'Consent & Compliance': AUDIENCE_EXPORT_COLUMNS.filter(c => c.group === 'Consent'),
    }
  }, [])

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
    setProgress('Preparing audience export...')

    try {
      const payload: Record<string, any> = {
        businessId: business.id,
        columns: selectedColumns,
        filename: filename.endsWith('.csv') ? filename : `${filename}.csv`,
      }

      if (scope === 'selected' && selectedIds.length > 0) {
        payload.ids = selectedIds
      } else {
        payload.tab = filters.tab || 'all'
        if (filters.q) payload.q = filters.q
        if (filters.phone) payload.phone = filters.phone
        if (filters.country) payload.country = filters.country
      }

      setProgressPercent(45)
      setProgress('Fetching audience records...')

      const res = await fetch('/api/audience/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: 'Export failed' }))
        throw new Error(errJson.error || 'Failed to download audience export')
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
      toast.success(`Successfully exported ${targetCount.toLocaleString('en-GB')} customer leads to CSV.`)
    } catch (err: any) {
      console.error('Audience export error:', err)
      setError(err?.message || 'Audience export failed. Please try again.')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  const STEPS = ['Select data', 'Verify columns', 'Check', 'Export']

  return (
    <Modal
      open={open}
      onClose={close}
      locked={busy}
      title={`Export audience to CSV · ${business.business_name}`}
      wide
    >
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
              <b>{business.business_name}</b>: {totalMatching.toLocaleString('en-GB')} customer leads
              {selectedIds.length > 0 && ` (${selectedIds.length} currently selected)`}.
            </div>
            <div className="text-xs text-slate-500">
              Tab: <span className="font-semibold text-slate-700">{filters.tab || 'all'}</span>
              {filters.phone && ` · Phone: ${filters.phone}`}
              {filters.country && ` · Country: ${filters.country}`}
            </div>
          </div>

          <p className="text-sm text-slate-600">
            Choose whether to export selected customers or all customer leads matching the current audience filters.
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
                  name="audience-scope"
                  className="mt-0.5 text-primary"
                  checked={scope === 'selected'}
                  onChange={() => setScope('selected')}
                />
                <div>
                  <div className="font-semibold text-slate-900 text-sm">
                    Selected customers only ({selectedIds.length.toLocaleString('en-GB')})
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Exports only the specific customer records currently ticked on the table.
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
                  name="audience-scope"
                  className="mt-0.5 text-primary"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                />
                <div>
                  <div className="font-semibold text-slate-900 text-sm">
                    All matching customers ({totalMatching.toLocaleString('en-GB')})
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Exports all audience records matching active filters across all pages.
                  </p>
                </div>
              </label>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                <FileSpreadsheet size={18} className="text-primary" />
                <span>Exporting all {totalMatching.toLocaleString('en-GB')} customer leads matching filters</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                All records matching current filters will be included in the exported CSV.
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
              placeholder="client-audience.csv"
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
              <b>{selectedColumns.length}</b> of <b>{AUDIENCE_EXPORT_COLUMNS.length}</b> columns selected.
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
            Verify each audience field to include in the exported CSV. Unchecked columns will be omitted.
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
                {scope === 'selected' ? 'Selected customers' : 'Matching audience'}
              </div>
            </div>

            {/* Box 2: With Phone */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 text-center">
              <div className="text-2xl font-bold text-blue-800">
                {activeStats.phoneCount.toLocaleString('en-GB')}
              </div>
              <div className="text-xs font-semibold text-blue-900">With Phone</div>
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

          {/* Customers Preview Table (using exact table-wrap and table text-xs) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Preview of customers to export (showing up to {previewRows.length} rows):</span>
              <span>
                {targetCount.toLocaleString('en-GB')} total customer{targetCount === 1 ? '' : 's'} will be exported
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
                    <tr key={r.id || idx}>
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
                <Phone size={13} className="text-teal-600 shrink-0" />
                Phone: {activeStats.phoneCount}
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-sky-700">
                <Mail size={13} className="text-sky-600 shrink-0" />
                Email: {activeStats.emailCount}
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              Clean data = customers with at least one verified direct contact (Phone or Email)
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
              {busy && <Spinner />} Export {targetCount.toLocaleString('en-GB')} customer{targetCount === 1 ? '' : 's'}
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
                  {progress || 'Exporting customers to CSV...'}
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
                    <span className="font-semibold text-slate-900">{targetCount.toLocaleString('en-GB')} customers</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-500 font-medium">Verified columns</span>
                    <span className="font-semibold text-slate-900">{selectedColumns.length} columns included</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-500 font-medium">Data scope</span>
                    <span className="font-medium text-slate-700">
                      {scope === 'selected' ? `Selected customers only (${selectedIds.length})` : `All matching customers (${totalMatching})`}
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
              <ErrorNote error={error || 'An unexpected error occurred during audience export.'} />
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
