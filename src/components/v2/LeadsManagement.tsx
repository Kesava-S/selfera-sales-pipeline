'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Filter, Upload, Plus, MoreVertical } from 'lucide-react'

import { CsvImportModal } from './CsvImportModal'

export function LeadsManagement({ 
  opportunities, 
  totalCount,
  currentPage,
  pageSize,
  search,
  filter,
  isAdmin
}: { 
  opportunities: any[],
  totalCount: number,
  currentPage: number,
  pageSize: number,
  search: string,
  filter: string,
  isAdmin: boolean
}) {
  const router = useRouter()
  const [showImport, setShowImport] = useState(false)

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const newSearch = formData.get('search') as string
    router.push(`/dashboard/leads?search=${encodeURIComponent(newSearch)}&filter=${encodeURIComponent(filter)}`)
  }

  const handleFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFilter = e.target.value
    router.push(`/dashboard/leads?search=${encodeURIComponent(search)}&filter=${encodeURIComponent(newFilter)}`)
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CsvImportModal isOpen={showImport} onClose={() => setShowImport(false)} />
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-semibold text-2xl">Leads & Opportunities</h1>
          <p className="text-muted text-sm mt-1">Manage and track your full pipeline.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowImport(true)} className="btn btn-outline bg-white dark:bg-black">
            <Upload size={16} className="mr-2" /> Import CSV
          </button>
          <button className="btn btn-primary">
            <Plus size={16} className="mr-2" /> Add Lead
          </button>
        </div>
      </div>

      <div className="card mb-6 p-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <form onSubmit={handleSearch} className="relative w-full md:w-96">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input 
              type="text" 
              name="search"
              defaultValue={search}
              placeholder="Search business names..." 
              className="input w-full pl-10 bg-gray-50 dark:bg-black border-[var(--card-border)]"
            />
          </form>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter size={16} className="text-muted" />
            <select 
              value={filter} 
              onChange={handleFilter}
              className="input w-full md:w-48 bg-gray-50 dark:bg-black border-[var(--card-border)]"
            >
              <option value="all">All Stages</option>
              <option value="Needs review">Needs review</option>
              <option value="Active">Active</option>
              <option value="Interested">Interested</option>
              <option value="Consultation">Consultation</option>
              <option value="Won">Won</option>
              <option value="Went cold">Went cold</option>
              <option value="No response">No response</option>
              <option value="Do not contact">Do not contact</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-white/5 text-muted border-b border-[var(--card-border)]">
            <tr>
              <th className="p-4 font-medium">Business</th>
              <th className="p-4 font-medium">Services Pitched</th>
              <th className="p-4 font-medium">Stage</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--card-border)]">
            {opportunities.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted">
                  No opportunities found.
                </td>
              </tr>
            ) : (
              opportunities.map(opp => (
                <tr key={opp.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <div className="font-semibold text-foreground">{opp.businesses.business_name}</div>
                    <div className="text-xs text-muted mt-1">{opp.businesses.business_type}</div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {opp.services_pitched?.map((s: string) => (
                        <span key={s} className="badge badge-neutral text-[10px]">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`badge ${
                      opp.stage === 'Won' ? 'bg-green-500/10 text-green-500' :
                      opp.stage === 'Interested' ? 'bg-blue-500/10 text-blue-500' :
                      opp.stage === 'Needs review' ? 'bg-amber-500/10 text-amber-500' :
                      opp.stage === 'No response' ? 'bg-gray-500/10 text-gray-500' :
                      'badge-neutral'
                    }`}>{opp.stage}</span>
                  </td>
                  <td className="p-4 text-right">
                    <Link href={`/dashboard/${opp.id}`} className="btn btn-outline btn-sm">
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8 mb-12">
          <Link 
            href={`/dashboard/leads?search=${encodeURIComponent(search)}&filter=${encodeURIComponent(filter)}&page=${currentPage - 1}`}
            className={`btn btn-outline ${currentPage === 1 ? 'opacity-50 pointer-events-none' : ''}`}
          >
            Previous
          </Link>
          <div className="flex items-center px-4 font-medium text-sm">
            Page {currentPage} of {totalPages}
          </div>
          <Link 
            href={`/dashboard/leads?search=${encodeURIComponent(search)}&filter=${encodeURIComponent(filter)}&page=${currentPage + 1}`}
            className={`btn btn-outline ${currentPage === totalPages ? 'opacity-50 pointer-events-none' : ''}`}
          >
            Next
          </Link>
        </div>
      )}
    </div>
  )
}
