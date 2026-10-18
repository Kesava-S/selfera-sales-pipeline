import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireProfile } from '@/lib/auth'
import { STATUS_PAGES } from '@/lib/config'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { StatusTypeBoxes } from '@/components/v2/DrilldownViews'
import { UnmatchedBookings } from '@/components/v2/AdminQueues'
import { ErrorNote } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function StatusPage({
  params,
}: {
  params: Promise<{ key: string }>
}) {
  const { key } = await params
  const def = STATUS_PAGES[key]
  if (!def) notFound()

  const { supabase, profile } = await requireProfile()
  if (!profile) return null
  if (def.adminOnly && profile.role !== 'admin') notFound()

  // Special queue for unmatched web bookings (no type step)
  if (key === 'unmatched-bookings') {
    const { data, error } = await supabase.rpc('list_unmatched_bookings')
    return (
      <div className="space-y-5">
        <BreadcrumbSetter
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Unmatched bookings' },
          ]}
        />
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <h1 className="mt-1">Unmatched bookings</h1>
          <p className="text-sm text-slate-500">
            Consultations booked on the website that didn&apos;t match a business by contact details or email. Link each one to the right business.
          </p>
        </div>
        <ErrorNote error={error?.message} />
        <UnmatchedBookings bookings={data || []} />
      </div>
    )
  }

  // Every other status box follows: status > business type > list > open
  const { data, error } = await supabase.rpc('status_type_counts', {
    p_status: key,
  })

  return (
    <div className="space-y-6">
      <BreadcrumbSetter
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: def.label },
        ]}
      />
      <ErrorNote error={error?.message} />
      <StatusTypeBoxes
        statusKey={key}
        statusLabel={def.label}
        counts={data || []}
      />
    </div>
  )
}
