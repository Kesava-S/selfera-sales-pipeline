'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CalendarClock, Inbox } from 'lucide-react'
import { formatDateTime } from '@/lib/format'
import { assignConsultant, linkBooking } from '@/app/dashboard/actions'
import { EmptyState, ErrorNote, Spinner, useAction } from '@/components/ui'
import type { PitchRow } from '@/components/v2/LeadsManagement'
import { createClient } from '@/lib/supabase/client'

export function ConsultantQueue({ rows, consultants }: { rows: (PitchRow & { consultation_at?: string | null })[]; consultants: { id: string; full_name: string }[] }) {
  const { run, pending, error } = useAction()
  const [choice, setChoice] = useState<Record<string, string>>({})
  if (!rows.length) return <EmptyState icon={<Inbox size={36} />} title="Nobody is waiting for a consultant" />
  return (
    <div className="space-y-3">
      <ErrorNote error={error} />
      {!consultants.length && <ErrorNote error="There are no consultants yet. Set someone's role to consultant in Supabase (see docs/admin-setup.md)." />}
      {rows.map(r => (
        <div key={r.opportunity_id} className="card flex flex-wrap items-center gap-3 !p-4">
          <div className="min-w-0 flex-1">
            <Link href={`/dashboard/${r.opportunity_id}`} className="font-semibold hover:text-primary">{r.business_name}</Link>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <CalendarClock size={13} /> {r.consultation_at ? formatDateTime(r.consultation_at) : 'No time set'} · {r.services_pitched.join(', ')} · Sales: {r.assigned_sales_name || 'nobody'}
            </div>
          </div>
          <select className="input !w-56" value={choice[r.opportunity_id] || ''} onChange={e => setChoice(c => ({ ...c, [r.opportunity_id]: e.target.value }))}>
            <option value="">Choose consultant…</option>
            {consultants.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <button className="btn btn-primary" disabled={!choice[r.opportunity_id] || pending} onClick={() => run(() => assignConsultant(r.opportunity_id, choice[r.opportunity_id]))}>
            {pending && <Spinner />} Assign
          </button>
        </div>
      ))}
    </div>
  )
}

type Booking = { id: string; name: string; business_name: string; email: string | null; phone: string | null; booked_for: string; message: string | null }

export function UnmatchedBookings({ bookings }: { bookings: Booking[] }) {
  if (!bookings.length) return <EmptyState icon={<Inbox size={36} />} title="No unmatched bookings" />
  return (
    <div className="space-y-3">
      {bookings.map(b => <BookingRow key={b.id} b={b} />)}
    </div>
  )
}

function BookingRow({ b }: { b: Booking }) {
  const { run, pending, error } = useAction()
  const [q, setQ] = useState(b.business_name)
  const [results, setResults] = useState<{ opportunity_id: string; business_name: string; stage: string; area: string | null }[]>([])
  const [pick, setPick] = useState('')
  const [searched, setSearched] = useState(false)

  const search = async () => {
    const supabase = createClient()
    const { data } = await supabase.rpc('list_pitches', { p_search: q, p_limit: 10 })
    setResults(data || [])
    setSearched(true)
    setPick('')
  }

  return (
    <div className="card space-y-3 !p-4">
      <div>
        <div className="font-semibold">{b.business_name} <span className="font-normal text-slate-500">({b.name})</span></div>
        <div className="text-xs text-slate-500">
          {formatDateTime(b.booked_for)} · {[b.phone, b.email].filter(Boolean).join(' · ') || 'no contact details'}
        </div>
        {b.message && <p className="mt-1 text-sm text-slate-600">{b.message}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <input className="input !w-64" value={q} onChange={e => setQ(e.target.value)} placeholder="Find the business" />
        <button className="btn btn-secondary" onClick={search}>Search</button>
        {results.length > 0 && (
          <select className="input !w-72" value={pick} onChange={e => setPick(e.target.value)}>
            <option value="">Pick the matching pitch…</option>
            {results.map(r => <option key={r.opportunity_id} value={r.opportunity_id}>{r.business_name}{r.area ? `, ${r.area}` : ''} ({r.stage})</option>)}
          </select>
        )}
        <button className="btn btn-primary" disabled={!pick || pending} onClick={() => run(() => linkBooking(b.id, pick))}>
          {pending && <Spinner />} Link booking
        </button>
      </div>
      {searched && results.length === 0 && <p className="text-xs text-amber-700">No matches. Try a shorter name (for example one word) or the postcode.</p>}
      <ErrorNote error={error} />
    </div>
  )
}
