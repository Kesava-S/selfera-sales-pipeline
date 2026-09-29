'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Upload, AlertCircle } from 'lucide-react'
import Papa from 'papaparse'
import { bulkImportLeads } from './actions'
import { useRouter } from 'next/navigation'
import type { CSVLeadRow } from '@/types/database'

export default function BulkImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<CSVLeadRow[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    
    setFile(selectedFile)
    setError(null)

    Papa.parse<CSVLeadRow>(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        // We expect columns like business_name, email, channel
        const parsedData = results.data
        
        // Basic validation
        const validData = parsedData.filter(row => row.business_name)
        if (validData.length === 0) {
          setError('No valid leads found in CSV. Make sure you have a "business_name" column.')
          return
        }
        
        setPreview(validData)
      },
      error: (err) => {
        setError('Error parsing CSV file: ' + err.message)
      }
    })
  }

  const handleImport = async () => {
    if (preview.length === 0) return
    
    setIsImporting(true)
    setError(null)
    
    try {
      const result = await bulkImportLeads(preview)
      
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
          Upload prospective leads from a CSV file into the commercial pipeline.
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
            padding: '2.5rem 1.5rem',
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
            <Upload size={36} className="text-muted mx-auto mb-4" style={{ margin: '0 auto 1rem', color: 'var(--primary)' }} />
            <div className="font-semibold" style={{ fontSize: '0.95rem', color: '#0f172a' }}>{file ? file.name : 'Click or drag CSV here'}</div>
            <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}>Accepts .csv up to 10MB</div>
          </div>

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
                style={{ width: '100%', padding: '0.8rem 1.4rem', borderRadius: '10px', fontSize: '0.925rem' }}
                onClick={handleImport}
                disabled={isImporting}
              >
                {isImporting ? 'Importing...' : `Import ${preview.length} Leads`}
              </button>
            </div>
          )}
        </div>

        <div className="card" style={{ gridColumn: 'span 2', padding: '1.75rem 2rem' }}>
          <h2 className="mb-4">Preview</h2>
          {!preview.length ? (
            <div className="text-muted text-center" style={{ padding: '3rem' }}>
              Upload a file to see a preview of the leads to be imported.
            </div>
          ) : (
            <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Business Name</th>
                    <th>Email</th>
                    <th>Channel</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      <td className="font-semibold">{row.business_name}</td>
                      <td>{row.email || <span className="text-muted">-</span>}</td>
                      <td>
                        <span className="badge badge-neutral">
                          {row.channel || 'Email'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {preview.length > 10 && (
                    <tr>
                      <td colSpan={3} className="text-center text-muted" style={{ padding: '1rem' }}>
                        ... and {preview.length - 10} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
