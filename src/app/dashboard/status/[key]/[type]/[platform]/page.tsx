import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { fromTypeSlug, toTypeSlug, fromPlatformSlug } from '@/lib/config'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { StatusLeadList, type StatusListRow } from '@/components/v2/DrilldownViews'
import { ErrorNote } from '@/components/ui'

export const dynamic = 'force-dynamic'
const PAGE_SIZE = 25

export default async function StatusTypePlatformPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string; type: string; platform: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { key, type, platform } = await params
  const sp = await searchParams

  // Only Needs reply has the platform sub-step
  if (key !== 'needs-reply') notFound()

  const canonicalType = fromTypeSlug(type)
  if (!canonicalType) notFound()

  const canonicalPlatform = fromPlatformSlug(platform)
  if (!canonicalPlatform) notFound()

  const { supabase, profile } = await requireProfile()
  if (!profile) return null

  const page = Math.max(1, parseInt(sp.page || '1') || 1)
  const offset = (page - 1) * PAGE_SIZE
  const typeSlug = toTypeSlug(canonicalType)

  const { data, error } = await supabase.rpc('status_list', {
    p_status: 'needs-reply',
    p_type: canonicalType,
    p_platform: canonicalPlatform,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  })

  const rows = (data as StatusListRow[]) || []
  const total = Number(rows[0]?.total_count ?? 0)

  return (
    <div className="space-y-6">
      <BreadcrumbSetter
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Needs reply', href: '/dashboard/status/needs-reply' },
          { label: canonicalType, href: `/dashboard/status/needs-reply/${typeSlug}` },
          { label: canonicalPlatform },
        ]}
      />
      <ErrorNote error={error?.message} />
      <StatusLeadList
        statusKey="needs-reply"
        statusLabel="Needs reply"
        typeLabel={canonicalType}
        typeSlug={typeSlug}
        platform={canonicalPlatform}
        rows={rows}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
      />
    </div>
  )
}
