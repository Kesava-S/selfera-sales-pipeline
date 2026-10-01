'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CONFIG } from '@/lib/config'
import { CheckCircle, BarChart2 } from 'lucide-react'

type TabType = 'new' | 'followup' | 'replies'

export function DashboardHome({ 
  statusCounts, 
  serviceCounts,
  dueThreads 
}: { 
  statusCounts: any
  serviceCounts: any[]
  dueThreads: any[]
}) {
  const [activeTab, setActiveTab] = useState<TabType>('new')

  // Filter threads for the active tab
  const newOutreach = dueThreads.filter(t => t.step === 0 && t.status !== 'Replied')
  const followUps = dueThreads.filter(t => t.step > 0 && t.status !== 'Replied')
  const replies = dueThreads.filter(t => t.status === 'Replied')

  const displayedThreads = activeTab === 'new' ? newOutreach 
    : activeTab === 'followup' ? followUps 
    : replies

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Column 1: Due Today */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-slate-800">Due Today</h2>
          <div className="card flex flex-col min-h-[500px]">
            <div className="flex gap-2 border-b border-[var(--card-border)] mb-4 px-2 pt-2">
              <button 
                onClick={() => setActiveTab('new')}
                className={`pb-3 px-2 text-sm font-semibold transition-colors relative ${activeTab === 'new' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
              >
                New
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700">{newOutreach.length}</span>
                {activeTab === 'new' && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-600 rounded-t-full" />}
              </button>
              <button 
                onClick={() => setActiveTab('followup')}
                className={`pb-3 px-2 text-sm font-semibold transition-colors relative ${activeTab === 'followup' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Follow-ups
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">{followUps.length}</span>
                {activeTab === 'followup' && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-600 rounded-t-full" />}
              </button>
              <button 
                onClick={() => setActiveTab('replies')}
                className={`pb-3 px-2 text-sm font-semibold transition-colors relative ${activeTab === 'replies' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Replies
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-green-100 text-green-700">{replies.length}</span>
                {activeTab === 'replies' && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-600 rounded-t-full" />}
              </button>
            </div>

            <div className="flex flex-col gap-2 flex-1 px-4 pb-4">
              {displayedThreads.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 text-slate-400 py-12">
                  <CheckCircle size={32} className="mb-3 opacity-20" />
                  <p className="text-sm font-medium">All caught up!</p>
                </div>
              ) : (
                displayedThreads.map(thread => (
                  <Link 
                    href={`/dashboard/${thread.opportunities.id}/thread/${thread.id}`}
                    key={thread.id} 
                    className="flex flex-col gap-1.5 p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                        {thread.opportunities.businesses.business_name}
                      </div>
                      <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">
                        {thread.platform}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-medium">
                      {activeTab === 'new' ? 'First Contact' : activeTab === 'replies' ? 'Awaiting your reply' : `Follow-up ${thread.step}`}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Column 2: Queue by service */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-slate-800">Queue by service</h2>
          <div className="flex flex-col gap-3">
            {CONFIG.SERVICES.map(service => {
              const stats = serviceCounts.find(s => s.service_name === service) || { replies_count: 0, active_count: 0, won_count: 0 }
              
              return (
                <Link href={`/dashboard/service/${encodeURIComponent(service)}`} key={service} className="card p-5 hover:shadow-md transition-all duration-300 hover:border-blue-500/30 group cursor-pointer flex flex-col gap-4">
                  <h3 className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">{service}</h3>
                  <div className="flex justify-between items-center bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <div className="text-center flex-1 border-r border-slate-200 last:border-0">
                      <div className="text-xl font-bold text-slate-700">{stats.active_count}</div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Active</div>
                    </div>
                    <div className="text-center flex-1 border-r border-slate-200 last:border-0">
                      <div className="text-xl font-bold text-amber-600">{stats.replies_count}</div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Replies</div>
                    </div>
                    <div className="text-center flex-1">
                      <div className="text-xl font-bold text-green-600">{stats.won_count}</div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Won</div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>


      </div>
    </div>
  )
}
