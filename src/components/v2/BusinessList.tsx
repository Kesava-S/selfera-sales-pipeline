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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {opportunities.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted bg-gray-50/50 dark:bg-white/5 rounded-lg border border-[var(--card-border)]">
            <Search size={32} className="mx-auto mb-4 opacity-30" />
            <p>No businesses found matching your criteria.</p>
          </div>
        ) : (
          opportunities.map(opp => {
            const b = opp.businesses
            
            // Collect platform statuses
            const platformStatuses: Record<string, string> = {}
            if (opp.threads) {
              opp.threads.forEach((t: any) => {
                platformStatuses[t.platform] = t.status
              })
            }

            const platforms = ['Email', 'WhatsApp', 'Instagram', 'Facebook']

            return (
              <Link 
                key={opp.id} 
                href={`/dashboard/${opp.id}`}
                className="flex flex-col p-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-blue-300 hover:shadow-md transition-all gap-4 group"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-1" title={b.business_name}>
                      {b.business_name}
                    </h3>
                    <span className={`badge shrink-0 ml-2 ${
                      opp.stage === 'Won' ? 'bg-green-100 text-green-700 border-green-200' :
                      opp.stage === 'Interested' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                      opp.stage === 'Needs review' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                      opp.stage === 'No response' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                      'badge-neutral'
                    }`}>{opp.stage}</span>
                  </div>
                  
                  <div className="text-sm text-slate-500 flex items-center gap-2">
                    {b.area && <span className="line-clamp-1">{b.area}</span>}
                    {b.area && b.google_rating && <span>•</span>}
                    {b.google_rating && <span className="flex items-center gap-1 shrink-0">⭐ {b.google_rating}</span>}
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Channels
                  </div>
                  <div className="flex items-center gap-2">
                    {platforms.map(p => {
                      const status = platformStatuses[p]
                      let dotColor = 'bg-slate-200'
                      if (status === 'due') dotColor = 'bg-amber-400'
                      else if (status === 'replied') dotColor = 'bg-blue-500'
                      else if (status === 'sent') dotColor = 'bg-green-500'
                      else if (status === 'archived') dotColor = 'bg-slate-400'
                      else if (!status) dotColor = 'bg-slate-100 opacity-50'

                      return (
                        <div 
                          key={p} 
                          className="flex items-center justify-center w-7 h-7 rounded bg-slate-50 border border-slate-200"
                          title={`${p}${status ? `: ${status}` : ''}`}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`}></div>
                        </div>
                      )
                    })}
                  </div>
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
