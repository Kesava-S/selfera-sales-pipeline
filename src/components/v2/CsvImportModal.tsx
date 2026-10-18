'use client'

// CSV import in 4 steps: Upload > Match columns > Check > Import.
// - Check step: shows "X ready, Y missing data, Z cannot import (no name), D duplicates".
// - Saves ALL rows with a business name into "Needs review".
// - Batches of 500 with progress bar, tied to an import_batches record.
// - Finish screen: "X sent to Approval queue, Y in Missing data" with buttons to open each.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { Upload, Download, AlertTriangle, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react'
import { CONFIG, LEAD_CATEGORIES } from '@/lib/config'
import {
  FIELDS,
  autoMap,
  buildRow,
  guessType,
  clean,
  type FieldKey,
  type ImportRow,
  PROBLEM_LABELS,
} from '@/lib/importFields'
import { ChipSelect, ErrorNote, Modal, Spinner } from '@/components/ui'
import { createImportBatch } from '@/app/dashboard/actions'

const MAX_ROWS = 5000
const CHUNK = 500
type Choice = 'skip' | 'update' | 'new_pitch'
type Match = { idx: number; business_id: string; business_name: string; matched_by: string; open_pitches: number }

export function CsvImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [raw, setRaw] = useState<Record<string, string>[]>([])
  const [map, setMap] = useState<Partial<Record<FieldKey, string>>>({})
  const [defaultServices, setDefaultServices] = useState<string[]>([])
  const [typeOverrides, setTypeOverrides] = useState<Record<string, string>>({})
  const [matches, setMatches] = useState<Match[]>([])
  const [choices, setChoices] = useState<Record<number, Choice>>({})
  const [busy, setBusy] = useState(false)
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)
  const [ignored, setIgnored] = useState(0)
  const [progress, setProgress] = useState('')
  const [progressPercent, setProgressPercent] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    batchId?: string
    created: number
    updated: number
    pitches: number
    skipped: number
    failed: number
    ready: number
    missing: number
    errors: { idx: number; message: string }[]
  } | null>(null)

  const reset = () => {
    setStep(1)
    setFileName('')
    setHeaders([])
    setRaw([])
    setMap({})
    setDefaultServices([])
    setTypeOverrides({})
    setMatches([])
    setChoices({})
    setBusy(false)
    setCheckingDuplicates(false)
    setIgnored(0)
    setProgress('')
    setProgressPercent(0)
    setError(null)
    setResult(null)
  }

  const close = () => {
    reset()
    onClose()
  }

  // ---------- Step 1: Upload file ----------
  const onFile = (file?: File) => {
    setError(null)
    if (!file) return
    if (!/\.csv$/i.test(file.name)) {
      return setError('Please choose a .csv file. In Excel or Google Sheets use File > Download > CSV.')
    }
    if (file.size > 10 * 1024 * 1024) {
      return setError('The file is larger than 10 MB. Split it into smaller files.')
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: h => h.replace(/^﻿/, '').trim(),
      complete: res => {
        const hs = (res.meta.fields || []).filter(Boolean)
        const all = res.data.filter(r => Object.values(r).some(v => clean(v)))
        const isHeader = (r: Record<string, string>) =>
          hs.filter(h => clean(r[h]).toLowerCase() === h.toLowerCase()).length >= Math.min(2, hs.length)
        const rows = all.filter(r => Object.values(r).filter(v => clean(v)).length > 1 && !isHeader(r))
        setIgnored(all.length - rows.length)
        if (!hs.length || !rows.length) {
          return setError('No rows found. Check the first row has the column names.')
        }
        if (rows.length > MAX_ROWS) {
          return setError(`The file has ${rows.length} rows. Import at most ${MAX_ROWS} at a time.`)
        }
        setFileName(file.name)
        setHeaders(hs)
        setRaw(rows)
        setMap(autoMap(hs))
        setStep(2)
      },
      error: () => setError('Could not read this file.'),
    })
  }

  // Unknown business types in file
  const unknownTypes = useMemo(() => {
    const col = map.business_type
    if (!col) return []
    const counts = new Map<string, number>()
    raw.forEach(r => {
      const v = clean(r[col])
      if (v && !guessType(v)) counts.set(v, (counts.get(v) || 0) + 1)
    })
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [raw, map.business_type])

  // ---------- Build rows (all 10 checks) ----------
  const builtRows: ImportRow[] = useMemo(() => {
    if (!raw.length) return []
    return raw.map((r, i) => buildRow(r, map, typeOverrides, defaultServices, i))
  }, [raw, map, typeOverrides, defaultServices])

  const mappingProblems = [
    !map.business_name && 'Match the "Business name" column.',
    !map.business_type && 'Match the "Category" column.',
    !map.services && !defaultServices.length && 'Pick the services to pitch (or match a services column).',
  ].filter(Boolean) as string[]

  // ---------- Transition to Step 3: Check Duplicates ----------
  const goToCheckStep = async () => {
    setError(null)
    setCheckingDuplicates(true)
    setProgress('Checking duplicates against existing leads...')
    try {
      const candidates = builtRows.filter(r => !r.isCannotImport)
      const allMatches: Match[] = []
      for (let i = 0; i < candidates.length; i += CHUNK) {
        const chunk = candidates.slice(i, i + CHUNK).map(r => ({
          idx: r.idx,
          business_name: r.data.business_name,
          whatsapp_number: r.data.whatsapp_number,
          email: r.data.email,
          linkedin: r.data.linkedin,
          postcode: r.data.postcode,
        }))
        const res = await fetch('/api/leads/duplicates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: chunk }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Duplicate check failed')
        allMatches.push(...(json.matches || []))
      }
      setMatches(allMatches)
      setChoices(Object.fromEntries(allMatches.map(m => [m.idx, 'skip' as Choice])))
      setStep(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Duplicate check failed')
    } finally {
      setCheckingDuplicates(false)
      setProgress('')
    }
  }

  // Row classifications for Step 3
  const duplicateIdxSet = useMemo(() => new Set(matches.map(m => m.idx)), [matches])
  const readyCount = useMemo(
    () => builtRows.filter(r => r.isReady && !duplicateIdxSet.has(r.idx)).length,
    [builtRows, duplicateIdxSet]
  )
  const missingCount = useMemo(
    () => builtRows.filter(r => r.isMissingData && !duplicateIdxSet.has(r.idx)).length,
    [builtRows, duplicateIdxSet]
  )
  const cannotImportCount = useMemo(
    () => builtRows.filter(r => r.isCannotImport).length,
    [builtRows]
  )
  const duplicatesCount = matches.length

  // ---------- Step 4: Import ----------
  const startImport = async () => {
    setBusy(true)
    setError(null)
    setProgressPercent(0)
    setProgress('Preparing import batch...')

    // Create batch in database
    let batchId: string | undefined
    try {
      const batchRes = await createImportBatch(fileName || 'leads.csv')
      if (batchRes.ok && batchRes.data) {
        batchId = batchRes.data
      }
    } catch (e) {
      console.warn('Could not create batch record, proceeding without batchId:', e)
    }

    const byIdx = new Map(matches.map(m => [m.idx, m]))
    const importableRows = builtRows.filter(r => !r.isCannotImport)
    const payload = importableRows
      .map(r => {
        const m = byIdx.get(r.idx)
        const action = m ? choices[r.idx] || 'skip' : 'new'
        return {
          idx: r.idx,
          action,
          existing_id: m?.business_id,
          services: r.services,
          branches: r.data.branches,
          ...r.data,
        }
      })
      .filter(r => r.action !== 'skip')

    if (!payload.length) {
      setBusy(false)
      setError('No rows to import (all rows were skipped or cannot be imported).')
      return
    }

    const total = {
      batchId,
      created: 0,
      updated: 0,
      pitches: 0,
      skipped: builtRows.length - payload.length,
      failed: 0,
      ready: 0,
      missing: 0,
      errors: [] as { idx: number; message: string }[],
    }

    try {
      for (let i = 0; i < payload.length; i += CHUNK) {
        const chunk = payload.slice(i, i + CHUNK)
        const pct = Math.round((i / payload.length) * 100)
        setProgressPercent(pct)
        setProgress(`Importing ${Math.min(i + CHUNK, payload.length)} of ${payload.length} leads (${pct}%)…`)

        const res = await fetch('/api/leads/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: chunk, batch_id: batchId }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Import failed')

        total.created += json.created || 0
        total.updated += json.updated || 0
        total.pitches += json.pitches || 0
        total.skipped += json.skipped || 0
        total.failed += json.failed || 0
        total.ready += json.ready || 0
        total.missing += json.missing || 0
        total.errors.push(...(json.errors || []))
      }
      setProgressPercent(100)
      setResult(total)
      setStep(4)
      router.refresh()
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : 'Import failed'}. Any rows saved before this failure were kept.`
      )
      if (total.created + total.updated + total.pitches > 0) {
        setResult(total)
      }
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  // Download unimportable rows (no name)
  const downloadCannotImport = () => {
    const unimportable = builtRows
      .filter(r => r.isCannotImport)
      .map(r => ({
        row_number: r.line,
        reason: 'Missing business name',
        ...raw[r.idx],
      }))
    if (!unimportable.length) return
    const csv = Papa.unparse(unimportable)
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `cannot-import-no-name-${fileName || 'leads.csv'}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const STEPS = ['Upload', 'Match columns', 'Check', 'Import']

  return (
    <Modal open={open} onClose={close} title="Import leads from CSV" wide>
      {/* Stepper Header */}
      <ol className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        {STEPS.map((s, i) => {
          const stepNum = i + 1
          const isActive = step === stepNum
          const isDone = step > stepNum
          return (
            <li
              key={s}
              className={`flex items-center gap-2 rounded-full px-3 py-1 font-semibold transition-colors ${
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : isDone
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold">
                {stepNum}
              </span>
              <span>{s}</span>
            </li>
          )
        })}
      </ol>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="space-y-5">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center transition-colors hover:border-primary hover:bg-slate-50/80">
            <Upload className="mb-3 text-slate-400" size={32} />
            <span className="text-base font-semibold text-slate-800">Choose a CSV file</span>
            <span className="mt-1 text-sm text-slate-500">
              Up to {MAX_ROWS.toLocaleString('en-GB')} rows. Exports from Excel, Google Sheets, or CRM tools work.
            </span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
          </label>

          <ErrorNote error={error} />

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <a
              href="/import-template.csv"
              download
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <Download size={15} /> Download template CSV
            </a>
          </div>
        </div>
      )}

      {/* Step 2: Match columns */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            <div>
              <b>{fileName}</b>: {raw.length.toLocaleString('en-GB')} rows
              {ignored > 0 && ` (${ignored} title or repeated header rows ignored)`}.
            </div>
            <button className="font-semibold text-primary hover:underline" onClick={reset}>
              Choose another file
            </button>
          </div>

          <p className="text-sm text-slate-600">
            Match each field to the corresponding column in your CSV. Required fields are marked with an asterisk (*).
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map(f => (
              <div key={f.key} className="space-y-1">
                <label className="label text-xs">
                  {f.label}
                  {f.required && ' *'}
                </label>
                <select
                  className="input !py-1.5 text-sm"
                  value={map[f.key] || ''}
                  onChange={e => setMap(m => ({ ...m, [f.key]: e.target.value || undefined }))}
                >
                  <option value="">Not in file</option>
                  {headers.map((h, i) => (
                    <option key={`${h}-${i}`}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Services Fallback */}
          {!map.services && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <label className="label mb-2">Services to pitch (applies to all rows) *</label>
              <ChipSelect options={CONFIG.SERVICES} value={defaultServices} onChange={setDefaultServices} />
            </div>
          )}
          {map.services && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <label className="label mb-2">Services fallback (for rows where services column is empty)</label>
              <ChipSelect options={CONFIG.SERVICES} value={defaultServices} onChange={setDefaultServices} />
            </div>
          )}

          {/* Category synonyms fallback */}
          {unknownTypes.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="mb-3 text-sm font-semibold text-amber-900">
                These categories in your file do not match our standard categories. Map each one:
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {unknownTypes.map(([val, n]) => (
                  <div key={val} className="flex items-center gap-2">
                    <span className="w-1/2 truncate text-sm" title={val}>
                      {val} <span className="text-slate-500">({n})</span>
                    </span>
                    <select
                      className="input !py-1 text-sm"
                      value={typeOverrides[val] || ''}
                      onChange={e => setTypeOverrides(o => ({ ...o, [val]: e.target.value }))}
                    >
                      <option value="">Leave unmapped</option>
                      {LEAD_CATEGORIES.map(t => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mappingProblems.length > 0 && <ErrorNote error={mappingProblems.join(' ')} />}
          <ErrorNote error={error} />

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <button className="btn btn-secondary" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              className="btn btn-primary"
              disabled={!raw.length || mappingProblems.length > 0 || checkingDuplicates}
              onClick={goToCheckStep}
            >
              {checkingDuplicates ? (
                <>
                  <Spinner /> Checking duplicates...
                </>
              ) : (
                'Next: Check rows'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Check */}
      {step === 3 && (
        <div className="space-y-5">
          {/* 4 Summary Boxes */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Box 1: Ready */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 text-center">
              <div className="text-2xl font-bold text-emerald-800">{readyCount}</div>
              <div className="text-xs font-semibold text-emerald-900">Ready</div>
              <div className="mt-1 text-[11px] text-emerald-700">Approval queue</div>
            </div>

            {/* Box 2: Missing data */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 text-center">
              <div className="text-2xl font-bold text-amber-800">{missingCount}</div>
              <div className="text-xs font-semibold text-amber-900">Missing data</div>
              <div className="mt-1 text-[11px] text-amber-700">Can be fixed in queue</div>
            </div>

            {/* Box 3: Cannot import */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3.5 text-center">
              <div className="text-2xl font-bold text-rose-800">{cannotImportCount}</div>
              <div className="text-xs font-semibold text-rose-900">Cannot import</div>
              <div className="mt-1 text-[11px] text-rose-700">No business name</div>
            </div>

            {/* Box 4: Duplicates */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 text-center">
              <div className="text-2xl font-bold text-blue-800">{duplicatesCount}</div>
              <div className="text-xs font-semibold text-blue-900">Duplicates</div>
              <div className="mt-1 text-[11px] text-blue-700">Existing businesses</div>
            </div>
          </div>

          {/* Duplicates Resolution Section (if any) */}
          {duplicatesCount > 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">
                  {duplicatesCount} duplicate lead{duplicatesCount === 1 ? '' : 's'} found
                </span>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-medium">Set all:</span>
                  {(['skip', 'update', 'new_pitch'] as Choice[]).map(c => (
                    <button
                      key={c}
                      className="chip text-xs !py-0.5"
                      onClick={() => setChoices(Object.fromEntries(matches.map(m => [m.idx, c])))}
                    >
                      {c === 'skip' ? 'Skip' : c === 'update' ? 'Update details' : 'New pitch'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="table-wrap max-h-56 overflow-y-auto">
                <table className="table text-xs">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>In file</th>
                      <th>Existing business</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map(m => (
                      <tr key={m.idx}>
                        <td className="text-slate-500">{m.idx + 2}</td>
                        <td className="font-semibold">{builtRows[m.idx]?.data.business_name}</td>
                        <td>
                          {m.business_name}
                          <span className="block text-[11px] text-slate-500">
                            matched by {m.matched_by}
                            {m.open_pitches ? ` (${m.open_pitches} open pitch)` : ''}
                          </span>
                        </td>
                        <td>
                          <select
                            className="input !py-1 text-xs"
                            value={choices[m.idx]}
                            onChange={e => setChoices(c => ({ ...c, [m.idx]: e.target.value as Choice }))}
                          >
                            <option value="skip">Skip</option>
                            <option value="update">Update details</option>
                            <option value="new_pitch">Add new pitch</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cannot import notice */}
          {cannotImportCount > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              <div className="flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>
                  {cannotImportCount} row{cannotImportCount === 1 ? '' : 's'} have no business name and will be skipped.
                </span>
              </div>
              <button
                className="font-semibold underline hover:text-rose-950 inline-flex items-center gap-1"
                onClick={downloadCannotImport}
              >
                <Download size={13} /> Download skipped rows
              </button>
            </div>
          )}

          {/* Leads Preview Table */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Preview of leads to import (showing up to 200 rows):</span>
              <span>
                {readyCount + missingCount} total lead{readyCount + missingCount === 1 ? '' : 's'} will be imported
              </span>
            </div>
            <div className="table-wrap max-h-72 overflow-y-auto">
              <table className="table text-xs">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Business</th>
                    <th>Category</th>
                    <th>Services</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {builtRows
                    .filter(r => !r.isCannotImport)
                    .slice(0, 200)
                    .map(r => {
                      const isDup = duplicateIdxSet.has(r.idx)
                      return (
                        <tr key={r.idx} className={r.isMissingData ? 'bg-amber-50/40' : ''}>
                          <td className="text-slate-500">{r.line}</td>
                          <td className="font-semibold">{r.data.business_name}</td>
                          <td>{r.data.business_type || <i className="text-slate-400">Missing</i>}</td>
                          <td>{r.services.join(', ') || <i className="text-slate-400">None</i>}</td>
                          <td>
                            {isDup ? (
                              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold text-blue-800">
                                Duplicate ({choices[r.idx]})
                              </span>
                            ) : r.isReady ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                                <CheckCircle2 size={13} /> Ready
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {r.problems.map(p => (
                                  <span
                                    key={p}
                                    className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900"
                                  >
                                    {PROBLEM_LABELS[p] || p}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>

          <ErrorNote error={error} />

          {/* Step 3 Actions */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <button className="btn btn-secondary" onClick={() => setStep(2)}>
              Back
            </button>
            <button
              className="btn btn-primary"
              disabled={readyCount + missingCount === 0 || busy}
              onClick={startImport}
            >
              Import {readyCount + missingCount} lead{readyCount + missingCount === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Import Progress & Finish */}
      {step === 4 && (
        <div className="space-y-6 py-2">
          {busy ? (
            <div className="space-y-4 text-center py-8">
              <Spinner className="mx-auto h-8 w-8 text-primary" />
              <div className="text-base font-semibold text-slate-800">{progress || 'Importing leads...'}</div>
              <div className="mx-auto h-2.5 w-full max-w-md overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">Do not close this window until the import completes.</p>
            </div>
          ) : result ? (
            <div className="space-y-6">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 text-center">
                <CheckCircle2 size={36} className="mx-auto text-emerald-600 mb-2" />
                <h3 className="text-lg font-bold text-slate-900">Import complete</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {result.created + result.updated + result.pitches} lead
                  {result.created + result.updated + result.pitches === 1 ? '' : 's'} imported from <b>{fileName}</b>.
                </p>
              </div>

              {/* Destination Breakdown */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                  <div className="text-3xl font-bold text-emerald-800">{result.ready}</div>
                  <div className="font-semibold text-slate-800 mt-1">Sent to Approval queue</div>
                  <p className="text-xs text-slate-500 mt-1">
                    All 10 required checks passed. Ready for review and outreach approval.
                  </p>
                  <button
                    className="btn btn-primary mt-4 w-full justify-center !py-2 text-sm"
                    onClick={() => {
                      close()
                      router.push('/dashboard/leads?tab=review')
                    }}
                  >
                    Open Approval queue <ArrowRight size={14} />
                  </button>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                  <div className="text-3xl font-bold text-amber-800">{result.missing}</div>
                  <div className="font-semibold text-slate-800 mt-1">In Missing data</div>
                  <p className="text-xs text-slate-500 mt-1">
                    Incomplete fields highlighted with red borders. Fix details inline to send them to the Approval queue.
                  </p>
                  <button
                    className="btn btn-secondary mt-4 w-full justify-center !py-2 text-sm"
                    onClick={() => {
                      close()
                      router.push('/dashboard/leads?tab=missing')
                    }}
                  >
                    Open Missing data <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              {/* Extra summary metrics */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
                {result.updated > 0 && <span>Updated: {result.updated}</span>}
                {result.pitches > 0 && <span>New pitches: {result.pitches}</span>}
                {result.skipped > 0 && <span>Skipped: {result.skipped}</span>}
                {result.failed > 0 && <span className="text-rose-600">Failed: {result.failed}</span>}
                <button className="text-primary font-semibold hover:underline" onClick={close}>
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <ErrorNote error={error || 'An unexpected error occurred during import.'} />
              <div className="flex justify-end">
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
