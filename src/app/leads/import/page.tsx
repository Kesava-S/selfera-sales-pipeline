'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, CheckCircle, AlertCircle } from 'lucide-react'
import Papa from 'papaparse'
import { bulkImportLeads } from './actions'
import { useRouter } from 'next/navigation'

export default function BulkImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    
    setFile(selectedFile)
    setError(null)

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        // We expect columns like business_name, email, channel
        const parsedData = results.data as any[]
        
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
    
    const result = await bulkImportLeads(preview)
    
    if (result.success) {
      router.push('/leads')
      router.refresh()
    } else {
      setError(result.error || 'Failed to import leads')
      setIsImporting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/leads" className="text-muted" style={{ display: 'flex' }}>
          <ArrowLeft size={20} />
        </Link>
        <h1 className="mb-0">Bulk Import Leads</h1>
      </div>

      <div className="grid grid-cols-3">
        <div className="card" style={{ gridColumn: 'span 1' }}>
          <h2 className="mb-4">Upload CSV</h2>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            Upload a CSV file containing your leads. The file must include a <strong>business_name</strong> column. Optional columns: <strong>email</strong>, <strong>channel</strong>.
          </p>
          
          <div className="mt-6" style={{
            border: '2px dashed var(--card-border)',
            borderRadius: '12px',
            padding: '2rem',
            textAlign: 'center',
            position: 'relative'
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
            <Upload size={32} className="text-muted mx-auto mb-4" style={{ margin: '0 auto 1rem' }} />
            <div className="font-semibold">{file ? file.name : 'Click or drag CSV here'}</div>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded flex items-center gap-2" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', fontSize: '0.875rem' }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {preview.length > 0 && !error && (
            <div className="mt-6">
              <button 
                className="btn btn-primary w-100" 
                style={{ width: '100%' }}
                onClick={handleImport}
                disabled={isImporting}
              >
                {isImporting ? 'Importing...' : `Import ${preview.length} Leads`}
              </button>
            </div>
          )}
        </div>

        <div className="card" style={{ gridColumn: 'span 2' }}>
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
