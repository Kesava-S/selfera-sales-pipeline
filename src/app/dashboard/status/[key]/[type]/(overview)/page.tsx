import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { STATUS_PAGES } from '@/lib/config'
import { categoryFromSlug, categorySlug } from '@/lib/lists'
import { getSalesLists } from '@/lib/dynamicData'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { ReplyPlatformBoxes, StatusLeadList, type StatusListRow } from '@/components/v2/DrilldownViews'
import { ErrorNote } from '@/components/ui'

export const dynamic = 'force-dynamic'
const PAGE_SIZE = 25

export default async function StatusTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string; type: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { key, type } = await params
  const sp = await searchParams
  const def = STATUS_PAGES[key]
  if (!def || key === 'unmatched-bookings') notFound()

  const lists = await getSalesLists()
  const canonicalType = categoryFromSlug(lists, type)
  if (!canonicalType) notFound()

  const { supabase, profile } = await requireProfile()
  if (!profile) return null
  if (def.adminOnly && profile.role !== 'admin') notFound()

  const typeSlug = categorySlug(lists, canonicalType)

  // Needs reply flow: status > type > platform boxes with counts
  if (key === 'needs-reply') {
    const { data, error } = await supabase.rpc('reply_platform_counts', {
      p_type: canonicalType,
    })

    return (
      <div className="space-y-6">
        <BreadcrumbSetter
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Needs reply', href: '/dashboard/status/needs-reply' },
            { label: canonicalType },
          ]}
        />
        <ErrorNote error={error?.message} />
        <ReplyPlatformBoxes
          typeLabel={canonicalType}
          typeSlug={typeSlug}
          counts={data || []}
        />
      </div>
    )
  }

  // All other statuses: status > type > list of leads
  const page = Math.max(1, parseInt(sp.page || '1') || 1)
  const offset = (page - 1) * PAGE_SIZE

  const [listRes, consultantsRes] = await Promise.all([
    supabase.rpc('status_list', {
      p_status: key,
      p_type: canonicalType,
      p_platform: null,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    }),
    key === 'needs-consultant'
      ? supabase
          .from('profiles')
          .select('id, full_name')
          .eq('role', 'consultant')
          .eq('is_active', true)
          .order('full_name')
      : Promise.resolve({ data: null, error: null }),
  ])

  const rows = (listRes.data as StatusListRow[]) || []
  const total = Number(rows[0]?.total_count ?? 0)

  return (
    <div className="space-y-6">
      <BreadcrumbSetter
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: def.label, href: `/dashboard/status/${key}` },
          { label: canonicalType },
        ]}
      />
      <ErrorNote error={listRes.error?.message || consultantsRes.error?.message} />
      <StatusLeadList
        statusKey={key}
        statusLabel={def.label}
        typeLabel={canonicalType}
        typeSlug={typeSlug}
        rows={rows}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        consultants={(consultantsRes.data as { id: string; full_name: string }[]) || []}
      />
    </div>
  )
}
