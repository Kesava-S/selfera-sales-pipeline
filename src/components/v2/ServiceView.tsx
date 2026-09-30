'use client'

import Link from 'next/link'
import { ArrowLeft, Building2 } from 'lucide-react'

export function ServiceView({ service, counts }: { service: string, counts: any[] }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard" className="btn btn-outline btn-sm p-2">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="font-semibold text-xl">{service} Campaigns</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {counts.map((c, i) => (
          <Link 
            key={i} 
            href={`/dashboard/service/${encodeURIComponent(service)}/${encodeURIComponent(c.business_type)}`}
            className="card hover:shadow-lg transition-all duration-300 hover:border-[var(--accent)] group cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Building2 size={18} />
              </div>
              <h3 className="font-semibold text-lg group-hover:text-[var(--accent)] transition-colors">{c.business_type}</h3>
            </div>
            
            <div className="flex justify-between text-sm mt-6 pt-4 border-t border-[var(--card-border)]">
              <div className="text-center">
                <div className="text-xl font-bold">{c.businesses_count}</div>
                <div className="text-muted text-xs uppercase tracking-wider">Total</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-amber-500">{c.replies_count}</div>
                <div className="text-muted text-xs uppercase tracking-wider">Replies</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-[var(--accent)]">{c.due_today_count}</div>
                <div className="text-muted text-xs uppercase tracking-wider">Due Today</div>
              </div>
            </div>
          </Link>
        ))}

        {counts.length === 0 && (
          <div className="col-span-3 text-center py-12 text-muted">
            <Building2 size={32} className="mx-auto mb-4 opacity-30" />
            <p>No businesses found for this service yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
