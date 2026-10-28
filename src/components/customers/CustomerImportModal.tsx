'use client'

// Client Audience: CSV import in 4 steps. Upload > Match columns > Check > Done.
// The check step reads every phone number (mobile, landline, invalid) before anything is saved.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { AlertTriangle, ArrowRight, CheckCircle2, Download, Upload } from 'lucide-react'
import { importCustomerLeads } from '@/app/dashboard/audience/actions'
import {
  autoMapColumns, cleanCustomer, missingFor, COUNTRIES, CSV_FIELDS, PHONE_TYPE_LABEL,
  type CleanCustomer, type Country, type CustomerInput,
} from '@/lib/customerLeads'
import { ErrorNote, Modal, Spinner, toast } from '@/components/ui'

const MAX_ROWS = 5000
const CHUNK = 500
type Field = keyof CustomerInput

const SAMPLE = 'First name,Last name,Email,Mobile,Landline,Town,Postcode,Last visit,Tags\nPriya,Shah,priya@example.com,07911 123456,,Leeds,LS1 4AP,14/09/2026,regular\n'

export function CustomerImportModal({ open, onClose, businessId, businessName }: { open: boolean; onClose: () => void; businessId: string; businessName: string }) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [raw, setRaw] = useState<Record<string, string>[]>([])
  const [map, setMap] = useState<Partial<Record<Field, string>>>({})
  const [country, setCountry] = useState<Country>('UK')
  const [consent, setConsent] = useState(false)
  const [duplicates, setDuplicates] = useState<'skip' | 'update'>('skip')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; failed: { row: number; message: string }[] } | null>(null)

  const reset = () => {
    setStep(1); setFileName(''); setHeaders([]); setRaw([]); setMap({}); setConsent(false)
    setDuplicates('skip'); setBusy(false); setProgress(0); setError(null); setResult(null)
  }
  const close = () => { if (busy) return; reset(); onClose() }

  const readFile = (file: File) => {
    setError(null)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: res => {
        const rows = res.data.filter(r => Object.values(r).some(v => String(v ?? '').trim()))
        const cols = (res.meta.fields || []).filter(Boolean)
        if (!cols.length || !rows.length) return setError('This file has no rows. Check it has a header row and at least one customer.')
        if (rows.length > MAX_ROWS) return setError(`This file has ${rows.length.toLocaleString('en-GB')} rows. Split it into files of ${MAX_ROWS.toLocaleString('en-GB')} or fewer.`)
        setFileName(file.name); setHeaders(cols); setRaw(rows); setMap(autoMapColumns(cols)); setStep(2)
      },
      error: () => setError('Could not read this file. Save it as CSV (comma separated) and try again.'),
    })
  }

  const inputs = useMemo(() => raw.map(r => {
    const input: CustomerInput = {}
    for (const f of CSV_FIELDS) { const h = map[f.key]; if (h) (input as Record<string, unknown>)[f.key] = r[h] }
    return input
  }), [raw, map])

  // Everything the check step shows, worked out once
  const check = useMemo(() => {
    if (step < 3) return null
    const rows: { row: number; data: CleanCustomer; problems: string[]; missing: string[] }[] = []
    let empty = 0
    const seen = new Set<string>()
    let dupes = 0
    const phones = { mobile: 0, landline: 0, other: 0, invalid: 0, none: 0 }
    inputs.forEach((input, i) => {
      const { row, problems } = cleanCustomer(input, country)
      if (!row) { empty++; return }
      const key = row.email || row.phone_e164
      if (key && seen.has(key)) dupes++
      if (key) seen.add(key)
      const t = row.phone_type ?? row.phone2_type
      if (!row.phone && !row.phone2) phones.none++
      else if (row.phone_type === 'mobile' || row.phone2_type === 'mobile') phones.mobile++
      else if (t === 'landline') phones.landline++
      else if (t === 'invalid') phones.invalid++
      else phones.other++
      rows.push({ row: i + 2, data: row, problems, missing: missingFor({ ...row, consent_confirmed: true }) })
    })
    return { rows, empty, dupes, phones, ready: rows.filter(r => !r.missing.length).length }
  }, [step, inputs, country])

  const mappedSomething = !!(map.first_name || map.email || map.phone || map.phone2)

  const runImport = async () => {
    setBusy(true); setError(null); setProgress(0)
    const total = { created: 0, updated: 0, skipped: 0, failed: [] as { row: number; message: string }[] }
    let batchId: string | null = null
    const rows = inputs.map((input, i) => ({ row: i + 2, input }))
    try {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const res = await importCustomerLeads(businessId, rows.slice(i, i + CHUNK), { country, consent, duplicates, fileName, batchId })
        if (!res.ok) throw new Error(res.error)
        const d = res.data!
        batchId = d.batchId
        total.created += d.created; total.updated += d.updated; total.skipped += d.skipped; total.failed.push(...d.failed)
        setProgress(Math.min(100, Math.round(((i + CHUNK) / rows.length) * 100)))
      }
      setResult(total); setStep(4)
      toast.success(`${total.created.toLocaleString('en-GB')} customers added.`)
      router.refresh()
    } catch (e) {
      // Chunks already saved stay saved; say how far it got
      setResult(total.created || total.updated ? total : null)
      setError(`${e instanceof Error ? e.message : 'Import stopped.'}${total.created ? ` ${total.created} were added before it stopped.` : ''}`)
      if (total.created || total.updated) router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const sampleHref = `data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`

  return (
    <Modal open={open} onClose={close} locked={busy} wide title={`Import customers · ${businessName}`}>
      <ol className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400">
        {['Upload', 'Match columns', 'Check', 'Done'].map((s, i) => (
          <li key={s} className={`flex items-center gap-2 ${step === i + 1 ? 'text-primary' : step > i + 1 ? 'text-emerald-600' : ''}`}>
            {i > 0 && <ArrowRight size={12} className="text-slate-300" />}{i + 1}. {s}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="label">Where are these customers?</label>
            <select className="input !w-auto" value={country} onChange={e => setCountry(e.target.value as Country)}>
              {COUNTRIES.map(c => <option key={c} value={c}>{c === 'India' ? 'India (test data)' : c}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-500">Numbers without +44 or +91 are read as this country. Numbers with a code keep their own.</p>
          </div>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center hover:border-primary hover:bg-primary-bg">
            <Upload size={28} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-700">Choose a CSV file</span>
            <span className="text-xs text-slate-500">Up to {MAX_ROWS.toLocaleString('en-GB')} customers. First row must be column names.</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = '' }} />
          </label>
          <a href={sampleHref} download="customer-leads-sample.csv" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"><Download size={14} /> Download a sample CSV</a>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600"><b>{fileName}</b> · {raw.length.toLocaleString('en-GB')} rows. Match each field to a column in the file.</p>
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {CSV_FIELDS.map(f => (
              <div key={f.key} className="flex items-center gap-2">
                <span className="w-40 shrink-0 text-sm font-medium text-slate-700">{f.label}</span>
                <select className="input !py-1.5" value={map[f.key] ?? ''} onChange={e => setMap({ ...map, [f.key]: e.target.value || undefined })}>
                  <option value="">Not in file</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          {!mappedSomething && <p className="text-sm text-amber-700">Match at least a name, an email or a phone column.</p>}
          <div className="flex justify-between gap-2 pt-2">
            <button className="btn btn-secondary" onClick={reset}>Choose another file</button>
            <button className="btn btn-primary" disabled={!mappedSomething} onClick={() => setStep(3)}>Check rows <ArrowRight size={16} /></button>
          </div>
        </div>
      )}

      {step === 3 && check && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Ready" value={check.ready} tone="emerald" />
            <Stat label="Missing data" value={check.rows.length - check.ready} tone="amber" />
            <Stat label="Same customer twice" value={check.dupes} tone="slate" />
            <Stat label="Empty rows (skipped)" value={check.empty} tone="slate" />
          </div>
          <p className="text-sm text-slate-600">
            Phones: <b>{check.phones.mobile}</b> mobile (WhatsApp) · <b>{check.phones.landline}</b> landline · <b>{check.phones.other}</b> other ·{' '}
            <b className={check.phones.invalid ? 'text-red-600' : ''}>{check.phones.invalid}</b> invalid · <b>{check.phones.none}</b> no phone
          </p>

          <div className="table-wrap max-h-64 overflow-y-auto">
            <table className="table">
              <thead><tr><th>Row</th><th>Name</th><th>Email</th><th>Phone</th><th>Check</th></tr></thead>
              <tbody>
                {check.rows.slice(0, 50).map(r => (
                  <tr key={r.row}>
                    <td className="text-xs text-slate-400">{r.row}</td>
                    <td>{[r.data.first_name, r.data.last_name].filter(Boolean).join(' ') || <span className="italic text-slate-400">No name</span>}</td>
                    <td className="text-xs">{r.data.email || '—'}</td>
                    <td className="text-xs">
                      {r.data.phone || r.data.phone2 || '—'}
                      {(r.data.phone_type || r.data.phone2_type) && <span className={`ml-1 font-semibold ${(r.data.phone_type ?? r.data.phone2_type) === 'invalid' ? 'text-red-600' : (r.data.phone_type ?? r.data.phone2_type) === 'mobile' ? 'text-sky-700' : 'text-slate-500'}`}>{PHONE_TYPE_LABEL[(r.data.phone_type ?? r.data.phone2_type)!].replace(' (free-phone, etc.)', '')}</span>}
                      {r.data.country !== country && <span className="ml-1 text-violet-700">{r.data.country}</span>}
                    </td>
                    <td className="text-xs">
                      {r.missing.length ? <span className="text-amber-700">Missing: {r.missing.join(', ')}</span> : <span className="text-emerald-700">Ready</span>}
                      {r.problems.length > 0 && <div className="text-red-600">{r.problems.join('; ')}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {check.rows.length > 50 && <p className="text-xs text-slate-500">Showing the first 50 of {check.rows.length.toLocaleString('en-GB')} rows.</p>}

          <div>
            <label className="label">Customers already saved for {businessName} (same email or phone)</label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`chip ${duplicates === 'skip' ? 'active' : ''}`} onClick={() => setDuplicates('skip')}>Skip them</button>
              <button type="button" className={`chip ${duplicates === 'update' ? 'active' : ''}`} onClick={() => setDuplicates('update')}>Update them with this file</button>
            </div>
          </div>
          <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <input type="checkbox" className="mt-1" checked={consent} onChange={e => setConsent(e.target.checked)} />
            {businessName} confirmed these customers agreed to receive marketing. This is recorded with your name and today&apos;s date.
          </label>

          {busy && (
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          <ErrorNote error={error} />
          <div className="flex justify-between gap-2">
            <button className="btn btn-secondary" disabled={busy} onClick={() => setStep(2)}>Back</button>
            <button className="btn btn-primary" disabled={busy || !consent || check.rows.length === 0} onClick={runImport}>
              {busy ? <Spinner /> : <Upload size={16} />} Import {check.rows.length.toLocaleString('en-GB')} customers
            </button>
          </div>
        </div>
      )}

      {step === 4 && result && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 size={20} className="motion-check-pop" /> <b>Import finished</b></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Added" value={result.created} tone="emerald" />
            <Stat label="Updated" value={result.updated} tone="sky" />
            <Stat label="Skipped" value={result.skipped} tone="slate" />
            <Stat label="Failed" value={result.failed.length} tone={result.failed.length ? 'red' : 'slate'} />
          </div>
          {result.failed.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              <p className="mb-1 flex items-center gap-1 font-semibold"><AlertTriangle size={13} /> Not imported</p>
              {result.failed.map(f => <div key={f.row}>Row {f.row}: {f.message}</div>)}
            </div>
          )}
          <div className="flex justify-end"><button className="btn btn-primary" onClick={close}>Done</button></div>
        </div>
      )}

      {step !== 3 && <ErrorNote error={error} />}
    </Modal>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'amber' | 'slate' | 'sky' | 'red' }) {
  const cls = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
    red: 'border-red-200 bg-red-50 text-red-800',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  }[tone]
  return (
    <div className={`rounded-xl border px-3 py-2 ${cls}`}>
      <p className="text-xl font-bold">{value.toLocaleString('en-GB')}</p>
      <p className="text-xs font-medium">{label}</p>
    </div>
  )
}
