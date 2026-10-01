'use client'

import { useState } from 'react'
import { X, Upload, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Step = 'upload' | 'map' | 'preview' | 'importing' | 'done'

export function CsvImportModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<any[]>([])
  
  const [mapping, setMapping] = useState<Record<string, string>>({
    business_name: '',
    business_type: '',
    area: '',
    contact_name: '',
    email_address: '',
    phone_number: '',
    instagram_handle: ''
  })
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState({ success: 0, failed: 0 })

  const dbFields = [
    { key: 'business_name', label: 'Business Name *', required: true },
    { key: 'business_type', label: 'Business Type *', required: true },
    { key: 'area', label: 'Area / Location' },
    { key: 'contact_name', label: 'Contact Name' },
    { key: 'email_address', label: 'Email' },
    { key: 'phone_number', label: 'Phone' },
    { key: 'instagram_handle', label: 'Instagram Handle' }
  ]

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    
    // Parse CSV locally (simple naive parser for MVP)
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length > 0) {
        const hdrs = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
        setHeaders(hdrs)
        
        const dataRows = lines.slice(1).map(l => {
          // simple split by comma, ignoring commas in quotes for this basic implementation
          const cols = l.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
          return cols
        })
        setRows(dataRows)

        // auto-map based on exact or partial matches
        const newMapping = { ...mapping }
        dbFields.forEach(field => {
          const match = hdrs.find(h => h.toLowerCase().includes(field.key.replace('_', ' ')))
          if (match) newMapping[field.key] = match
        })
        setMapping(newMapping)
        setStep('map')
      }
    }
    reader.readAsText(f)
  }

  const handleImport = async () => {
    setStep('importing')
    setIsImporting(true)
    
    try {
      // Build JSON payload
      const payload = rows.map(row => {
        const obj: any = {}
        dbFields.forEach(field => {
          const csvColName = mapping[field.key]
          if (csvColName) {
            const colIndex = headers.indexOf(csvColName)
            if (colIndex >= 0) {
              obj[field.key] = row[colIndex]
            }
          }
        })
        return obj
      })

      // Send to API
      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: payload })
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Import failed')

      setImportResult({ success: result.successCount, failed: result.failedCount })
      setStep('done')
      router.refresh()
    } catch (err) {
      console.error(err)
      alert('Import failed. See console for details.')
      setStep('preview')
    } finally {
      setIsImporting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-[#0a0a0a] shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-[var(--card-border)]">
          <h2 className="font-semibold text-lg">Import Leads (CSV)</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="text-center py-12">
              <Upload size={48} className="mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium mb-2">Upload your CSV file</h3>
              <p className="text-muted text-sm mb-6 max-w-md mx-auto">
                Your file should contain basic business information like name, type, and contact details.
              </p>
              <label className="btn btn-primary cursor-pointer inline-flex">
                <span>Select File</span>
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          )}

          {/* STEP 2: MAP */}
          {step === 'map' && (
            <div>
              <div className="mb-6">
                <h3 className="font-medium mb-1">Map Columns</h3>
                <p className="text-sm text-muted">Match your CSV columns to our database fields.</p>
              </div>
              <div className="space-y-4">
                {dbFields.map(field => (
                  <div key={field.key} className="flex items-center gap-4">
                    <div className="w-1/3 text-sm font-medium">
                      {field.label}
                    </div>
                    <div className="flex-1">
                      <select 
                        className="input w-full text-sm"
                        value={mapping[field.key]}
                        onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                      >
                        <option value="">-- Ignore --</option>
                        {headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex justify-end gap-3 border-t border-[var(--card-border)] pt-4">
                <button className="btn btn-outline" onClick={() => setStep('upload')}>Back</button>
                <button 
                  className="btn btn-primary"
                  onClick={() => setStep('preview')}
                  disabled={!mapping.business_name || !mapping.business_type}
                >
                  Continue to Preview <ArrowRight size={16} className="ml-2" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW */}
          {step === 'preview' && (
            <div>
              <div className="mb-6">
                <h3 className="font-medium mb-1">Preview Import</h3>
                <p className="text-sm text-muted">Review the first 3 rows to ensure data looks correct.</p>
              </div>
              
              <div className="overflow-x-auto border border-[var(--card-border)] rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-white/5 border-b border-[var(--card-border)]">
                    <tr>
                      {dbFields.map(f => (
                        <th key={f.key} className="p-3 font-medium whitespace-nowrap">{f.label.replace(' *', '')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--card-border)]">
                    {rows.slice(0, 3).map((row, i) => (
                      <tr key={i}>
                        {dbFields.map(f => {
                          const csvColName = mapping[f.key]
                          const colIndex = headers.indexOf(csvColName)
                          const val = colIndex >= 0 ? row[colIndex] : '-'
                          return <td key={f.key} className="p-3 truncate max-w-[150px]">{val || '-'}</td>
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400 rounded-lg flex gap-3 text-sm">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <p>You are about to import <strong>{rows.length}</strong> businesses. They will be placed in the <strong>Needs review</strong> stage.</p>
              </div>

              <div className="mt-8 flex justify-end gap-3 border-t border-[var(--card-border)] pt-4">
                <button className="btn btn-outline" onClick={() => setStep('map')}>Back</button>
                <button className="btn btn-primary" onClick={handleImport}>
                  Confirm & Import
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: IMPORTING & DONE */}
          {(step === 'importing' || step === 'done') && (
            <div className="text-center py-12">
              {step === 'importing' ? (
                <div className="mx-auto w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              ) : (
                <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
              )}
              
              <h3 className="text-lg font-medium mb-2">
                {step === 'importing' ? 'Importing Leads...' : 'Import Complete!'}
              </h3>
              
              {step === 'done' && (
                <>
                  <p className="text-muted text-sm mb-6">
                    Successfully imported {importResult.success} leads.
                    {importResult.failed > 0 && ` Failed to import ${importResult.failed} leads.`}
                  </p>
                  <button className="btn btn-primary" onClick={onClose}>
                    Close & View Leads
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
