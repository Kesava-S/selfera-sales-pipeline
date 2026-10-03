'use client'

// CSV import in 4 steps: Upload (match columns) > Check > Duplicates > Save.
// Everything is saved as "Needs review". No drafts until someone approves.
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { Upload, Download, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { CONFIG, BUSINESS_TYPES } from '@/lib/config'
import { FIELDS, autoMap, buildRow, guessType, clean, type FieldKey, type ImportRow } from '@/lib/importFields'
import { ChipSelect, ErrorNote, Modal, Spinner } from '@/components/ui'

const MAX_ROWS = 5000
const CHUNK = 500
type Choice = 'skip' | 'update' | 'new_pitch'
type Match = { idx: number; business_id: string; business_name: string; matched_by: string; open_pitches: number }

export function CsvImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [raw, setRaw] = useState<Record<string, string>[]>([])
  const [map, setMap] = useState<Partial<Record<FieldKey, string>>>({})
  const [defaultServices, setDefaultServices] = useState<string[]>([])
  const [typeOverrides, setTypeOverrides] = useState<Record<string, string>>({})
  const [matches, setMatches] = useState<Match[]>([])
  const [choices, setChoices] = useState<Record<number, Choice>>({})
  const [busy, setBusy] = useState(false)
  const [ignored, setIgnored] = useState(0)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ created: number; updated: number; pitches: number; skipped: number; failed: number; errors: { idx: number; message: string }[] } | null>(null)

  const reset = () => {
    setStep(1); setFileName(''); setHeaders([]); setRaw([]); setMap({}); setDefaultServices([]); setTypeOverrides({})
    setMatches([]); setChoices({}); setBusy(false); setIgnored(0); setProgress(''); setError(null); setResult(null)
  }
  const close = () => { reset(); onClose() }

  // ---------- Step 1: read file ----------
  const onFile = (file?: File) => {
    setError(null)
    if (!file) return
    if (!/\.csv$/i.test(file.name)) return setError('Please choose a .csv file. In Excel or Google Sheets use File > Download > CSV.')
    if (file.size > 10 * 1024 * 1024) return setError('The file is larger than 10 MB. Split it into smaller files.')
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: h => h.replace(/^﻿/, '').trim(),
      complete: res => {
        const hs = (res.meta.fields || []).filter(Boolean)
        // Skip section titles (one cell filled) and repeated header rows
        const all = res.data.filter(r => Object.values(r).some(v => clean(v)))
        const isHeader = (r: Record<string, string>) => hs.filter(h => clean(r[h]).toLowerCase() === h.toLowerCase()).length >= Math.min(2, hs.length)
        const rows = all.filter(r => Object.values(r).filter(v => clean(v)).length > 1 && !isHeader(r))
        setIgnored(all.length - rows.length)
        if (!hs.length || !rows.length) return setError('No rows found. Check the first row has the column names.')
        if (rows.length > MAX_ROWS) return setError(`The file has ${rows.length} rows. Import at most ${MAX_ROWS} at a time.`)
        setFileName(file.name)
        setHeaders(hs)
        setRaw(rows)
        setMap(autoMap(hs))
      },
      error: () => setError('Could not read this file.'),
    })
  }

  // Business type values that don't match our list (step 1, mapped by the user)
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

  // ---------- Step 2: build and check rows ----------
  const rows: ImportRow[] = useMemo(() => {
    if (step < 2) return []
    const built = raw.map((r, i) => buildRow(r, map, typeOverrides, defaultServices, i))
    // Same phone or email twice in this file
    const seen = new Map<string, number>()
    built.forEach(row => {
      const keys = [row.data.phone.replace(/\D/g, '').replace(/^44/, '0'), row.data.email].filter(k => k && k.length > 5)
      for (const k of keys) {
        if (seen.has(k)) {
          row.errors.push(`Same ${k.includes('@') ? 'email' : 'phone'} as row ${seen.get(k)! + 2}`)
          break
        }
        seen.set(k, row.idx)
      }
    })
    return built
  }, [step, raw, map, typeOverrides, defaultServices])

  const valid = rows.filter(r => !r.errors.length)
  const invalid = rows.filter(r => r.errors.length)

  const mappingProblems = [
    !map.business_name && 'Match the "Business name" column.',
    !map.business_type && 'Match the "Business type" column.',
    !map.services_to_pitch && !defaultServices.length && 'Pick the services to pitch (or match a services column).',
  ].filter(Boolean) as string[]

  // ---------- Step 3: duplicates ----------
  const checkDuplicates = async () => {
    setBusy(true)
    setError(null)
    try {
      const all: Match[] = []
      for (let i = 0; i < valid.length; i += CHUNK) {
        setProgress(`Checking ${Math.min(i + CHUNK, valid.length)} of ${valid.length}…`)
        const chunk = valid.slice(i, i + CHUNK).map(r => ({ idx: r.idx, business_name: r.data.business_name, phone: r.data.phone, email: r.data.email, postcode: r.data.postcode }))
        const res = await fetch('/api/leads/duplicates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: chunk }) })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Duplicate check failed')
        all.push(...json.matches)
      }
      setMatches(all)
      setChoices(Object.fromEntries(all.map(m => [m.idx, 'skip' as Choice])))
      setStep(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Duplicate check failed')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  // ---------- Step 4: save ----------
  const save = async () => {
    setBusy(true)
    setError(null)
    const byIdx = new Map(matches.map(m => [m.idx, m]))
    const payload = valid.map(r => {
      const m = byIdx.get(r.idx)
      const action = m ? choices[r.idx] || 'skip' : 'new'
      return { idx: r.idx, action, existing_id: m?.business_id, services: r.services, ...r.data }
    })
    const total = { created: 0, updated: 0, pitches: 0, skipped: 0, failed: 0, errors: [] as { idx: number; message: string }[] }
    try {
      for (let i = 0; i < payload.length; i += CHUNK) {
        setProgress(`Saving ${Math.min(i + CHUNK, payload.length)} of ${payload.length}…`)
        const res = await fetch('/api/leads/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: payload.slice(i, i + CHUNK) }) })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Import failed')
        total.created += json.created; total.updated += json.updated; total.pitches += json.pitches
        total.skipped += json.skipped; total.failed += json.failed; total.errors.push(...(json.errors || []))
      }
      setResult(total)
      setStep(4)
      router.refresh()
    } catch (e) {
      setError(`${e instanceof Error ? e.message : 'Import failed'}. Rows saved before this point are kept. Run the import again: duplicates will be found and skipped.`)
      if (total.created + total.updated + total.pitches) setResult(total)
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  const downloadProblems = () => {
    const bad = [
      ...invalid.map(r => ({ line: r.line, problem: r.errors.join('; '), ...raw[r.idx] })),
      ...(result?.errors || []).map(e => ({ line: e.idx + 2, problem: e.message, ...raw[e.idx] })),
    ]
    const csv = Papa.unparse(bad)
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `rows-to-fix-${fileName || 'import'}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const STEPS = ['Upload', 'Check', 'Duplicates', 'Save']

  return (
    <Modal open={open} onClose={close} title="Import leads from CSV" wide>
      <ol className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        {STEPS.map((s, i) => (
          <li key={s} className={`flex items-center gap-2 rounded-full px-3 py-1 font-semibold ${step === i + 1 ? 'bg-primary text-white' : step > i + 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="space-y-5">
          {!raw.length ? (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center hover:border-primary">
              <Upload className="mb-2 text-slate-400" />
              <span className="font-semibold">Choose a CSV file</span>
              <span className="mt-1 text-sm text-slate-500">Up to {MAX_ROWS.toLocaleString('en-GB')} rows. Exports from Excel or Google Sheets work.</span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
            </label>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                <b>{fileName}</b>: {raw.length.toLocaleString('en-GB')} rows{ignored > 0 && ` (${ignored} title or header row${ignored === 1 ? '' : 's'} ignored)`}. Check each field is matched to the right column.{' '}
                <button className="font-semibold text-primary hover:underline" onClick={reset}>Choose another file</button>
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {FIELDS.map(f => (
                  <div key={f.key}>
                    <label className="label">{f.label}{f.required && ' *'}</label>
                    <select className="input" value={map[f.key] || ''} onChange={e => setMap(m => ({ ...m, [f.key]: e.target.value || undefined }))}>
                      <option value="">Not in file</option>
                      {headers.map((h, i) => <option key={`${h}-${i}`}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              {!map.services_to_pitch && (
                <div>
                  <label className="label">Services to pitch (for every row) *</label>
                  <ChipSelect options={CONFIG.SERVICES} value={defaultServices} onChange={setDefaultServices} />
                </div>
              )}
              {map.services_to_pitch && (
                <div>
                  <label className="label">Services for rows where the services column is empty</label>
                  <ChipSelect options={CONFIG.SERVICES} value={defaultServices} onChange={setDefaultServices} />
                </div>
              )}
              {unknownTypes.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="mb-3 text-sm font-semibold text-amber-900">These business types aren&apos;t in our list. Pick the closest one (or leave them to skip those rows):</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {unknownTypes.map(([val, n]) => (
                      <div key={val} className="flex items-center gap-2">
                        <span className="w-1/2 truncate text-sm" title={val}>{val} <span className="text-slate-500">({n})</span></span>
                        <select className="input !py-1" value={typeOverrides[val] || ''} onChange={e => setTypeOverrides(o => ({ ...o, [val]: e.target.value }))}>
                          <option value="">Skip these rows</option>
                          {BUSINESS_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {mappingProblems.length > 0 && <ErrorNote error={mappingProblems.join(' ')} />}
            </>
          )}
          <ErrorNote error={error} />
          <div className="flex items-center justify-between gap-2">
            <a href="/import-template.csv" download className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              <Download size={15} /> Download the template
            </a>
            <button className="btn btn-primary" disabled={!raw.length || mappingProblems.length > 0} onClick={() => setStep(2)}>Next: check rows</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-lg bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800">{valid.length} ready</span>
            {invalid.length > 0 && <span className="rounded-lg bg-red-50 px-3 py-1.5 font-semibold text-red-700">{invalid.length} with problems (won&apos;t be imported)</span>}
          </div>
          <div className="table-wrap max-h-96 overflow-y-auto">
            <table className="table">
              <thead>
                <tr><th>Row</th><th>Business</th><th>Type</th><th>Services</th><th>Contact</th><th>Check</th></tr>
              </thead>
              <tbody>
                {[...invalid, ...valid].slice(0, 300).map(r => (
                  <tr key={r.idx} className={r.errors.length ? 'bg-red-50/60' : ''}>
                    <td className="text-slate-500">{r.line}</td>
                    <td className="font-semibold">{r.data.business_name || <i className="text-slate-400">missing</i>}</td>
                    <td>{r.data.business_type || <i className="text-slate-400">?</i>}</td>
                    <td className="text-xs">{r.services.join(', ')}</td>
                    <td className="text-xs text-slate-600">{[r.data.phone, r.data.email, r.data.instagram && `@${r.data.instagram}`].filter(Boolean).join(' · ') || '–'}</td>
                    <td className="text-xs">
                      {r.errors.length ? <span className="text-red-700">{r.errors.join('; ')}</span>
                        : r.warnings.length ? <span className="text-amber-700">{r.warnings.join('; ')}</span>
                          : <CheckCircle2 size={16} className="text-emerald-600" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 300 && <p className="text-xs text-slate-500">Showing the first 300 rows (problems first).</p>}
          <ErrorNote error={error} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
              {invalid.length > 0 && <button className="btn btn-ghost" onClick={downloadProblems}><Download size={15} /> Rows to fix</button>}
            </div>
            <button className="btn btn-primary" disabled={!valid.length || busy} onClick={checkDuplicates}>
              {busy && <Spinner />} {progress || `Next: check duplicates (${valid.length})`}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          {matches.length === 0 ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">No duplicates. All {valid.length} rows are new businesses.</p>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                {matches.length} row(s) match a business already in the system. Choose what to do with each.
              </p>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="font-semibold">Set all:</span>
                {(['skip', 'update', 'new_pitch'] as Choice[]).map(c => (
                  <button key={c} className="chip" onClick={() => setChoices(Object.fromEntries(matches.map(m => [m.idx, c])))}>
                    {c === 'skip' ? 'Skip' : c === 'update' ? 'Update details' : 'Add new pitch'}
                  </button>
                ))}
              </div>
              <div className="table-wrap max-h-80 overflow-y-auto">
                <table className="table">
                  <thead><tr><th>Row</th><th>In your file</th><th>Already in system</th><th>What to do</th></tr></thead>
                  <tbody>
                    {matches.map(m => (
                      <tr key={m.idx}>
                        <td className="text-slate-500">{m.idx + 2}</td>
                        <td>{rows[m.idx]?.data.business_name}</td>
                        <td>
                          {m.business_name}
                          <span className="block text-xs text-slate-500">same {m.matched_by}{m.open_pitches ? `, ${m.open_pitches} open pitch(es)` : ''}</span>
                        </td>
                        <td>
                          <select className="input !py-1" value={choices[m.idx]} onChange={e => setChoices(c => ({ ...c, [m.idx]: e.target.value as Choice }))}>
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
            </>
          )}
          <ErrorNote error={error} />
          <div className="flex justify-between gap-2">
            <button className="btn btn-secondary" onClick={() => setStep(2)} disabled={busy}>Back</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy && <Spinner />} {progress || 'Save to review queue'}
            </button>
          </div>
        </div>
      )}

      {step === 4 && result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['New businesses', result.created], ['New pitches', result.pitches], ['Updated', result.updated], ['Skipped', result.skipped]].map(([l, n]) => (
              <div key={l} className="rounded-xl border border-slate-200 p-3 text-center">
                <div className="text-2xl font-bold">{n}</div>
                <div className="text-xs font-semibold text-slate-500">{l}</div>
              </div>
            ))}
          </div>
          {(result.failed > 0 || invalid.length > 0) && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                {result.failed + invalid.length} row(s) were not imported.{' '}
                <button className="font-semibold underline" onClick={downloadProblems}>Download them with the reasons</button>, fix and import again.
              </span>
            </div>
          )}
          <p className="text-sm text-slate-600">New leads are in the <b>Review queue</b>. Check them, then approve to start outreach.</p>
          <div className="flex justify-end">
            <button className="btn btn-primary" onClick={() => { close(); router.push('/dashboard/leads?tab=review') }}>Go to review queue</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
