'use client'

// Client Audience: one card per client business, with how many of its
// customers are ready to market to. "Add a client" picks a business from Lead Management.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2, ChevronRight, Contact, Plus, Search } from 'lucide-react'
import { findBusinesses, type BusinessPick } from '@/app/dashboard/audience/actions'
import { EmptyState, ErrorNote, Modal, Spinner } from '@/components/ui'
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
  const [picking, setPicking] = useState(false)
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? clients.filter(c => `${c.business_name} ${c.contact_name || ''} ${c.area || ''}`.toLowerCase().includes(s)) : clients
  }, [clients, q])

  return (
    <div className="space-y-6">
      <PageHeader title="Client Audience" text="The customers of our client businesses, for marketing on the client's behalf. Separate from Lead Management.">
        <button className="btn btn-primary" onClick={() => setPicking(true)}><Plus size={16} /> Add a client</button>
      </PageHeader>

      {clients.length === 0 ? (
        <EmptyState icon={<Contact size={40} />} title="No clients yet" text="Pick a business from Lead Management, then add its customers by form or CSV.">
          <button className="btn btn-primary" onClick={() => setPicking(true)}><Plus size={16} /> Add a client</button>
        </EmptyState>
      ) : (
        <>
          {clients.length > 6 && (
            <div className="relative max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input !pl-9" placeholder="Search clients" value={q} onChange={e => setQ(e.target.value)} />
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map(c => (
              <Link key={c.business_id} href={`/dashboard/audience/${c.business_id}`} className="card card-link block">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{c.business_name}</p>
                    <p className="truncate text-xs text-slate-500">{[c.contact_name, c.business_type, c.area].filter(Boolean).join(' · ') || 'No details'}</p>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-slate-400" />
                </div>
                <p className="mt-4 text-2xl font-bold text-slate-900">{c.total.toLocaleString('en-GB')} <span className="text-sm font-medium text-slate-500">customers</span></p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="badge !border-emerald-200 !bg-emerald-50 !text-emerald-700">{c.ready} ready</span>
                  {c.missing > 0 && <span className="badge !border-amber-200 !bg-amber-50 !text-amber-700">{c.missing} missing data</span>}
                  {c.whatsapp > 0 && <span className="badge !border-sky-200 !bg-sky-50 !text-sky-700">{c.whatsapp} WhatsApp</span>}
                  {c.do_not_contact > 0 && <span className="badge !border-red-200 !bg-red-50 !text-red-700">{c.do_not_contact} do not contact</span>}
                  {c.test > 0 && <span className="badge !border-violet-200 !bg-violet-50 !text-violet-700">{c.test} test (India)</span>}
                </div>
                {c.last_added_at && <p className="mt-3 text-xs text-slate-400">Last added {formatDate(c.last_added_at)}</p>}
              </Link>
            ))}
          </div>
          {shown.length === 0 && <p className="text-sm text-slate-500">No clients match &ldquo;{q}&rdquo;.</p>}
        </>
      )}

      <PickClient open={picking} onClose={() => setPicking(false)} existing={new Set(clients.map(c => c.business_id))} />
    </div>
  )
}

function PickClient({ open, onClose, existing }: { open: boolean; onClose: () => void; existing: Set<string> }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<BusinessPick[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [going, setGoing] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let live = true
    const t = setTimeout(async () => {
      setLoading(true)
      const res = await findBusinesses(q).catch(() => ({ ok: false as const, error: 'Could not reach the server.' }))
      if (!live) return
      setLoading(false)
      if (res.ok) { setResults(res.data || []); setError(null) } else setError(res.error)
    }, q ? 250 : 0)
    return () => { live = false; clearTimeout(t) }
  }, [q, open])

  const go = (id: string) => {
    setGoing(id)
    router.push(`/dashboard/audience/${id}`)
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a client">
      <p className="text-sm text-slate-600">Pick the business whose customers you are adding. Businesses come from Lead Management and aren&apos;t changed.</p>
      <div className="relative mt-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input autoFocus className="input !pl-9" placeholder="Business or owner name" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <ErrorNote error={error} />
      <ul className="mt-3 max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
        {loading && results.length === 0 && <li className="flex items-center gap-2 px-3 py-3 text-sm text-slate-500"><Spinner size={14} /> Searching…</li>}
        {!loading && results.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">No businesses found.</li>}
        {results.map(b => (
          <li key={b.id}>
            <button className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 disabled:opacity-60" disabled={!!going} onClick={() => go(b.id)}>
              <Building2 size={16} className="shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-800">{b.business_name}</span>
                <span className="block truncate text-xs text-slate-500">{[b.contact_name, b.business_type, b.area].filter(Boolean).join(' · ')}</span>
              </span>
              {existing.has(b.id) && <span className="badge">Client</span>}
              {going === b.id ? <Spinner size={14} /> : <ChevronRight size={16} className="text-slate-400" />}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
