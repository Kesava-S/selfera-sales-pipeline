import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { STATUS_PAGES } from '@/lib/config'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { PitchCards } from '@/components/v2/PitchCards'
import { ConsultantQueue, UnmatchedBookings } from '@/components/v2/AdminQueues'
import { ErrorNote } from '@/components/ui'

export const dynamic = 'force-dynamic'
const PAGE_SIZE = 24

export default async function Page({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ q?: string; page?: string }> }) {
  const { key } = await params
  const sp = await searchParams
  const def = STATUS_PAGES[key]
  if (!def) notFound()
  const { supabase, profile } = await requireProfile()
  if (!profile) return null
  if (def.adminOnly && profile.role !== 'admin') notFound()
  const page = Math.max(1, parseInt(sp.page || '1') || 1)
  const crumbs = <BreadcrumbSetter breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: def.label }]} />

  if (key === 'unmatched-bookings') {
    const { data, error } = await supabase.rpc('list_unmatched_bookings')
    return (
      <div className="space-y-5">
        {crumbs}
        <h1>Unmatched bookings</h1>
        <p className="text-sm text-slate-500">Consultations booked on the website that didn&apos;t match a business by phone or email. Link each one to the right business.</p>
        <ErrorNote error={error?.message} />
        <UnmatchedBookings bookings={data || []} />
      </div>
    )
  }

  const { data, error } = await supabase.rpc('list_pitches', {
    p_filter: def.filter, p_search: sp.q || null, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE,
  })

  if (key === 'needs-consultant') {
    const { data: consultants } = await supabase.from('profiles').select('id, full_name').eq('role', 'consultant').eq('is_active', true).order('full_name')
    return (
      <div className="space-y-5">
        {crumbs}
        <h1>Needs consultant</h1>
        <ErrorNote error={error?.message} />
        <ConsultantQueue rows={data || []} consultants={consultants || []} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {crumbs}
      <h1>{def.label}</h1>
      <ErrorNote error={error?.message} />
      <PitchCards
        rows={data || []}
        total={Number(data?.[0]?.total_count ?? 0)}
        page={page}
        pageSize={PAGE_SIZE}
        basePath={`/dashboard/status/${key}`}
        params={sp as Record<string, string | undefined>}
        showChips={false}
      />
    </div>
  )
}
