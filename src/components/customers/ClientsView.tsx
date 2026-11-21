'use client'

// Client Audience: one card per client (a Won lead, added automatically when it is
// marked Won; migration 72), with how many of its customers are ready to market to.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronRight, Contact, MessageCircle, Search, ShieldOff, Trophy, TriangleAlert } from 'lucide-react'
import { EmptyState, InfoTip } from '@/components/ui'
import { formatDate } from '@/lib/format'

export type ClientRow = {
  business_id: string
  business_name: string
  contact_name: string | null
  business_type: string | null
  area: string | null
  total: number
  ready: number
  missing: number
  do_not_contact: number
  whatsapp: number
  test: number
  last_added_at: string | null
  source?: 'won' | 'manual' | string | null // 'won' = added when the lead was marked Won
  added_at?: string | null
}

export function PageHeader({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="!mb-0 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        </div>
        <p className="mt-0.5 text-sm text-slate-500">{text}</p>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}

export function ClientsView({ clients }: { clients: ClientRow[] }) {
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? clients.filter(c => `${c.business_name} ${c.contact_name || ''} ${c.area || ''}`.toLowerCase().includes(s)) : clients
  }, [clients, q])

  return (
    <div className="space-y-6">
      <PageHeader title="Client Audience" text="Customers of our Won clients, for marketing on the client's behalf.">
        <InfoTip align="right" text="A lead marked Won in Lead Management is added here automatically. Add its customers by form or CSV." />
      </PageHeader>

      {clients.length === 0 ? (
        <EmptyState icon={<Contact size={40} />} title="No clients yet" text="Leads marked Won in Lead Management appear here automatically." />
      ) : (
        <>
          {clients.length > 6 && (
            <div className="relative max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input !pl-9" placeholder="Search clients" value={q} onChange={e => setQ(e.target.value)} />
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {shown.map(c => (
              <Link key={c.business_id} href={`/dashboard/audience/${c.business_id}`} className="card card-link block">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                      <span className="truncate">{c.business_name}</span>
                    </p>
                    <p className="truncate text-xs text-slate-500">{[c.contact_name, c.business_type, c.area].filter(Boolean).join(' · ') || 'No details'}</p>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-slate-400" />
                </div>
                <p className="mt-4 text-2xl font-bold text-slate-900">{c.total.toLocaleString('en-GB')} <span className="text-sm font-medium text-slate-500">customers</span></p>
                {c.total === 0 ? (
                  <p className="mt-2 text-xs font-medium text-amber-700">No customers yet. Open to add or import them.</p>
                ) : (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold">
                  <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={12} />{c.ready} ready</span>
                  {c.missing > 0 && <span className="inline-flex items-center gap-1 text-amber-700"><TriangleAlert size={12} />{c.missing} missing data</span>}
                  {c.whatsapp > 0 && <span className="inline-flex items-center gap-1 text-sky-700"><MessageCircle size={12} />{c.whatsapp} WhatsApp</span>}
                  {c.do_not_contact > 0 && <span className="inline-flex items-center gap-1 text-red-700"><ShieldOff size={12} />{c.do_not_contact} do not contact</span>}
                </div>
                )}
                {c.last_added_at ? <p className="mt-3 text-xs text-slate-400">Last added {formatDate(c.last_added_at)}</p>
                  : c.added_at && <p className="mt-3 inline-flex items-center gap-1 text-xs text-slate-400"><Trophy size={11} /> Won {formatDate(c.added_at)}</p>}
              </Link>
            ))}
          </div>
          {shown.length === 0 && <p className="text-sm text-slate-500">No clients match &ldquo;{q}&rdquo;.</p>}
        </>
      )}

    </div>
  )
}
