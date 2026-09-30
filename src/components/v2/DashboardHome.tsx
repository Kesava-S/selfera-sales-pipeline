'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CONFIG } from '@/lib/config'
import { MessageSquare, RefreshCw, Send, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

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
      <h1 className="mb-6 font-semibold">Dashboard</h1>

      {/* 1. DUE TODAY STRIP */}
      <div className="card mb-8">
        <h2 className="text-lg font-semibold mb-4">Due Today</h2>
        
        <div className="flex gap-4 border-b border-[var(--card-border)] mb-4">
          <button 
            onClick={() => setActiveTab('new')}
            className={`pb-2 px-1 font-medium transition-colors relative ${activeTab === 'new' ? 'text-[var(--accent)]' : 'text-muted hover:text-foreground'}`}
          >
            New outreach <span className="ml-2 badge bg-[var(--accent)]/10 text-[var(--accent)]">{newOutreach.length}</span>
            {activeTab === 'new' && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-[var(--accent)]" />}
          </button>
          <button 
            onClick={() => setActiveTab('followup')}
            className={`pb-2 px-1 font-medium transition-colors relative ${activeTab === 'followup' ? 'text-[var(--accent)]' : 'text-muted hover:text-foreground'}`}
          >
            Follow-ups <span className="ml-2 badge badge-neutral">{followUps.length}</span>
            {activeTab === 'followup' && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-[var(--accent)]" />}
          </button>
          <button 
            onClick={() => setActiveTab('replies')}
            className={`pb-2 px-1 font-medium transition-colors relative ${activeTab === 'replies' ? 'text-[var(--accent)]' : 'text-muted hover:text-foreground'}`}
          >
            Replies <span className="ml-2 badge bg-green-500/10 text-green-500">{replies.length}</span>
            {activeTab === 'replies' && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-[var(--accent)]" />}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {displayedThreads.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <CheckCircle size={32} className="mx-auto mb-2 opacity-50" />
              All caught up for today!
            </div>
          ) : (
            displayedThreads.map(thread => (
              <div key={thread.id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--card-border)] bg-gray-50/50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                    {thread.opportunities.businesses.business_name.substring(0, 1)}
                  </div>
                  <div>
                    <div className="font-semibold">{thread.opportunities.businesses.business_name}</div>
                    <div className="text-xs text-muted flex items-center gap-2">
                      <span className="badge badge-neutral">{thread.platform}</span>
                      <span>•</span>
                      <span>{activeTab === 'new' ? 'First Contact' : activeTab === 'replies' ? 'Awaiting your reply' : `Follow-up ${thread.step}`}</span>
                    </div>
                  </div>
                </div>
                <Link href={`/dashboard/${thread.opportunities.id}/thread/${thread.id}`} className="btn btn-primary btn-sm">
                  Open
                </Link>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. STATUS ROW */}
      <h2 className="text-lg font-semibold mb-4">Pipeline Status</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatusBox title="Needs reply" count={statusCounts.needs_reply || 0} icon={<MessageSquare size={18} />} color="text-amber-500" bgColor="bg-amber-500/10" link="/dashboard/status/needs_reply" />
        <StatusBox title="Interested" count={statusCounts.interested || 0} icon={<CheckCircle size={18} />} color="text-green-500" bgColor="bg-green-500/10" link="/dashboard/status/interested" />
        <StatusBox title="Consultation" count={statusCounts.consultation || 0} icon={<RefreshCw size={18} />} color="text-blue-500" bgColor="bg-blue-500/10" link="/dashboard/status/consultation" />
        <StatusBox title="Went cold" count={statusCounts.went_cold || 0} icon={<Clock size={18} />} color="text-purple-500" bgColor="bg-purple-500/10" link="/dashboard/status/went_cold" />
        <StatusBox title="No response" count={statusCounts.no_response || 0} icon={<AlertCircle size={18} />} color="text-gray-500" bgColor="bg-gray-500/10" link="/dashboard/status/no_response" />
      </div>

      {/* 3. SERVICE ROW */}
      <h2 className="text-lg font-semibold mb-4">Services Pipeline</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CONFIG.SERVICES.map(service => {
          const stats = serviceCounts.find(s => s.service_name === service) || { replies_count: 0, active_count: 0, won_count: 0 }
          
          return (
            <Link href={`/dashboard/service/${encodeURIComponent(service)}`} key={service} className="card hover:shadow-lg transition-all duration-300 hover:border-[var(--accent)] group cursor-pointer">
              <h3 className="font-semibold mb-4 group-hover:text-[var(--accent)] transition-colors">{service}</h3>
              <div className="flex justify-between text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.active_count}</div>
                  <div className="text-muted text-xs uppercase tracking-wider">Active</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-500">{stats.replies_count}</div>
                  <div className="text-muted text-xs uppercase tracking-wider">Replies</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500">{stats.won_count}</div>
                  <div className="text-muted text-xs uppercase tracking-wider">Won</div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function StatusBox({ title, count, icon, color, bgColor, link }: { title: string, count: number, icon: any, color: string, bgColor: string, link: string }) {
  return (
    <Link href={link} className="card p-4 hover:shadow-md transition-shadow cursor-pointer flex flex-col items-center text-center">
      <div className={`w-10 h-10 rounded-full ${bgColor} ${color} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <div className="text-2xl font-bold mb-1">{count}</div>
      <div className="text-xs text-muted font-medium uppercase tracking-wider">{title}</div>
    </Link>
  )
}
