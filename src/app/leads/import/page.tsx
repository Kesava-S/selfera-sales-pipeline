'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Upload, AlertCircle, AlertTriangle, CheckCircle, ShieldCheck } from 'lucide-react'
import Papa from 'papaparse'
import { bulkImportLeads, checkBulkDuplicates, BulkDuplicateCheckResult } from './actions'
import { useRouter } from 'next/navigation'
import type { CSVLeadRow } from '@/types/database'

export default function BulkImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<CSVLeadRow[]>([])
  const [duplicates, setDuplicates] = useState<BulkDuplicateCheckResult[]>([])
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    
    setFile(selectedFile)
    setError(null)
    setDuplicates([])

    Papa.parse<CSVLeadRow>(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        // Expect columns like business_name, email, phone, channel
        const parsedData = results.data
        
        // Basic validation
        const validData = parsedData.filter(row => row.business_name)
        if (validData.length === 0) {
          setError('No valid leads found in CSV. Make sure you have a "business_name" column.')
          return
        }
        
        setPreview(validData)

        // Asynchronously check duplicates against sales-pipe database
        setIsCheckingDuplicates(true)
        try {
          const dups = await checkBulkDuplicates(validData)
          setDuplicates(dups)
        } catch (err) {
          console.error('Error checking duplicates in CSV:', err)
        } finally {
          setIsCheckingDuplicates(false)
        }
      },
      error: (err) => {
        setError('Error parsing CSV file: ' + err.message)
      }
    })
  }

  const duplicateMap = new Map(duplicates.map(d => [d.rowIndex, d]))
  const uniqueCount = Math.max(0, preview.length - duplicates.length)
  const toImportCount = skipDuplicates ? uniqueCount : preview.length

  const handleImport = async () => {
    if (preview.length === 0) return
    
    setIsImporting(true)
    setError(null)
    
    try {
      const skipIndices = skipDuplicates ? duplicates.map(d => d.rowIndex) : []
      const result = await bulkImportLeads(preview, { skipDuplicateIndices: skipIndices })
      
      if (result.success) {
        router.push('/leads')
        router.refresh()
        return
      }
      
      if (result.error) {
        setError(result.error)
        setIsImporting(false)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to import leads into database'
      setError(msg)
      setIsImporting(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 700, margin: '0 0 0.2rem 0', color: '#0f172a', letterSpacing: '-0.02em' }}>
          Bulk Import Leads
        </h1>
        <p className="text-muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Upload prospective leads from a CSV file into the commercial pipeline with automated duplicate protection.
        </p>
      </div>

      <div className="grid grid-cols-3" style={{ gap: '1.25rem', alignItems: 'start' }}>
        <div className="card" style={{ gridColumn: 'span 1', padding: '1.25rem 1.5rem', borderRadius: '12px' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0f172a' }}>Upload CSV</h2>
          <p className="text-muted" style={{ fontSize: '0.825rem', lineHeight: 1.5 }}>
            Upload a CSV file containing your leads. The file must include a <strong>business_name</strong> column. Optional columns: <strong>email</strong>, <strong>channel</strong>, <strong>phone</strong>.
          </p>
          
          <div className="mt-6" style={{
            border: '2px dashed #cbd5e1',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            padding: '2.25rem 1.5rem',
            textAlign: 'center',
            position: 'relative',
            cursor: 'pointer',
          }}>
            <input 
              type="file" 
              accept=".csv"
              onChange={handleFileUpload}
              style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                opacity: 0, cursor: 'pointer'
              }}
            />
            <Upload size={34} className="text-muted mx-auto mb-4" style={{ margin: '0 auto 0.75rem', color: 'var(--primary)' }} />
            <div className="font-semibold" style={{ fontSize: '0.925rem', color: '#0f172a' }}>{file ? file.name : 'Click or drag CSV here'}</div>
            <div className="text-muted" style={{ fontSize: '0.775rem', marginTop: '0.35rem' }}>Accepts .csv up to 10MB</div>
          </div>

          {isCheckingDuplicates && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#eff6ff', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} />
              <span>Checking database for duplicates...</span>
            </div>
          )}

          {duplicates.length > 0 && !isCheckingDuplicates && (
            <div style={{ marginTop: '1rem', padding: '0.85rem', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b45309', fontWeight: 700, fontSize: '0.85rem' }}>
                <AlertTriangle size={16} />
                <span>{duplicates.length} duplicate lead(s) detected</span>
              </div>
              <p style={{ margin: '0.35rem 0 0.75rem', fontSize: '0.775rem', color: '#92400e', lineHeight: 1.4 }}>
                Existing pipeline records matched by email or phone. Choose how you want to handle them:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: skipDuplicates ? 600 : 400 }}>
                  <input
                    type="radio"
                    name="duplicatePolicy"
                    checked={skipDuplicates}
                    onChange={() => setSkipDuplicates(true)}
                  />
                  <span>Skip duplicates (import {uniqueCount} unique)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: !skipDuplicates ? 600 : 400 }}>
                  <input
                    type="radio"
                    name="duplicatePolicy"
                    checked={!skipDuplicates}
                    onChange={() => setSkipDuplicates(false)}
                  />
                  <span>Import all anyway ({preview.length} leads)</span>
                </label>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 rounded flex items-center gap-2.5" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', fontSize: '0.875rem', borderRadius: '10px' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {preview.length > 0 && !error && (
            <div className="mt-6">
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '0.75rem 1.4rem', borderRadius: '10px', fontSize: '0.9rem' }}
                onClick={handleImport}
                disabled={isImporting || isCheckingDuplicates || toImportCount === 0}
              >
                {isImporting ? 'Importing...' : `Import ${toImportCount} Leads`}
              </button>
            </div>
          )}
        </div>

        <div className="card" style={{ gridColumn: 'span 2', padding: '1.5rem 1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Preview</h2>
            {preview.length > 0 && (
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Total rows: <strong>{preview.length}</strong> | Unique: <strong>{uniqueCount}</strong> | Duplicates: <strong>{duplicates.length}</strong>
              </span>
            )}
          </div>

          {!preview.length ? (
            <div className="text-muted text-center" style={{ padding: '3.5rem 1rem' }}>
              Upload a file to see a preview of the leads to be imported.
            </div>
          ) : (
            <div className="table-container" style={{ maxHeight: '520px', overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Business Name</th>
                    <th>Email</th>
                    <th>Channel</th>
                    <th>Duplicate Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => {
                    const dup = duplicateMap.get(i)
                    return (
                      <tr key={i} style={{ backgroundColor: dup ? '#fffbeb' : undefined }}>
                        <td className="font-semibold">{row.business_name}</td>
                        <td>{row.email || <span className="text-muted">-</span>}</td>
                        <td>
                          <span className="badge badge-neutral">
                            {row.channel || 'Email'}
                          </span>
                        </td>
                        <td>
                          {dup ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: '#fef3c7',
                                color: '#b45309',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '6px',
                                fontSize: '0.725rem',
                                fontWeight: 600,
                              }}
                              title={`Matches existing lead ${dup.match.lead_code || ''}: ${dup.match.business_name} (${dup.match.stage}) via ${dup.match.match_reason}`}
                            >
                              <AlertTriangle size={12} />
                              <span>Exists ({dup.match.stage})</span>
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                color: '#059669',
                                fontSize: '0.725rem',
                                fontWeight: 600,
                              }}
                            >
                              <CheckCircle size={12} />
                              <span>Unique</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
