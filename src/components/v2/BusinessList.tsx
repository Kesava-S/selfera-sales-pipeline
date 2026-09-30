'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Search, Filter, MessageSquare } from 'lucide-react'

export function BusinessList({ 
  service, 
  type, 
  opportunities, 
  totalCount,
  currentPage,
  pageSize,
  search,
  filter
}: { 
  service: string, 
  type: string,
  opportunities: any[],
  totalCount: number,
  currentPage: number,
  pageSize: number,
  search: string,
  filter: string
}) {
  const router = useRouter()

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const newSearch = formData.get('search') as string
    router.push(`/dashboard/service/${encodeURIComponent(service)}/${encodeURIComponent(type)}?search=${encodeURIComponent(newSearch)}&filter=${encodeURIComponent(filter)}`)
  }

  const handleFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFilter = e.target.value
    router.push(`/dashboard/service/${encodeURIComponent(service)}/${encodeURIComponent(type)}?search=${encodeURIComponent(search)}&filter=${encodeURIComponent(newFilter)}`)
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/dashboard/service/${encodeURIComponent(service)}`} className="btn btn-outline btn-sm p-2">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="font-semibold text-xl">{type} <span className="text-muted text-sm font-normal">({totalCount} total)</span></h1>
          <p className="text-sm text-muted">{service} Campaigns</p>
        </div>
      </div>

      <div className="card mb-8 flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50 dark:bg-[#0a0a0a]">
        <form onSubmit={handleSearch} className="relative w-full md:w-96">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input 
            type="text" 
            name="search"
            defaultValue={search}
            placeholder="Search business names..." 
            className="input w-full pl-10"
          />
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={16} className="text-muted" />
          <select 
            value={filter} 
            onChange={handleFilter}
            className="input w-full md:w-48"
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

      <div className="flex flex-col gap-3 mb-8">
        {opportunities.length === 0 ? (
          <div className="text-center py-12 text-muted bg-gray-50/50 dark:bg-white/5 rounded-lg border border-[var(--card-border)]">
            <Search size={32} className="mx-auto mb-4 opacity-30" />
            <p>No businesses found matching your criteria.</p>
          </div>
        ) : (
          opportunities.map(opp => {
            const b = opp.businesses
            const latestThread = opp.threads?.sort((a: any, b: any) => 
              new Date(b.next_due_on || 0).getTime() - new Date(a.next_due_on || 0).getTime()
            )[0]

            return (
              <Link 
                key={opp.id} 
                href={`/dashboard/${opp.id}`}
                className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border border-[var(--card-border)] bg-gray-50/50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors gap-4"
              >
                <div className="flex-1">
                  <div className="font-semibold text-lg">{b.business_name}</div>
                  <div className="text-sm text-muted flex items-center gap-2 mt-1">
                    {b.area && <span>{b.area}</span>}
                    {b.area && b.google_rating && <span>•</span>}
                    {b.google_rating && <span className="flex items-center gap-1">⭐ {b.google_rating}</span>}
                  </div>
                </div>

                <div className="flex-1 flex flex-col items-start md:items-center justify-center">
                  <span className={`badge ${
                    opp.stage === 'Won' ? 'bg-green-500/10 text-green-500' :
                    opp.stage === 'Interested' ? 'bg-blue-500/10 text-blue-500' :
                    opp.stage === 'Needs review' ? 'bg-amber-500/10 text-amber-500' :
                    opp.stage === 'No response' ? 'bg-gray-500/10 text-gray-500' :
                    'badge-neutral'
                  }`}>{opp.stage}</span>
                </div>

                <div className="flex-1 flex items-center justify-end gap-3 text-sm">
                  {latestThread ? (
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-2">
                        <MessageSquare size={14} className="text-muted" />
                        <span className="font-medium">{latestThread.platform}</span>
                      </div>
                      <div className="text-xs text-muted mt-1">{latestThread.status}</div>
                    </div>
                  ) : (
                    <div className="text-muted text-xs">No active threads</div>
                  )}
                </div>
              </Link>
            )
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mb-12">
          <Link 
            href={`/dashboard/service/${encodeURIComponent(service)}/${encodeURIComponent(type)}?search=${encodeURIComponent(search)}&filter=${encodeURIComponent(filter)}&page=${currentPage - 1}`}
            className={`btn btn-outline ${currentPage === 1 ? 'opacity-50 pointer-events-none' : ''}`}
          >
            Previous
          </Link>
          <div className="flex items-center px-4 font-medium">
            Page {currentPage} of {totalPages}
          </div>
          <Link 
            href={`/dashboard/service/${encodeURIComponent(service)}/${encodeURIComponent(type)}?search=${encodeURIComponent(search)}&filter=${encodeURIComponent(filter)}&page=${currentPage + 1}`}
            className={`btn btn-outline ${currentPage === totalPages ? 'opacity-50 pointer-events-none' : ''}`}
          >
            Next
          </Link>
        </div>
      )}
    </div>
  )
}
