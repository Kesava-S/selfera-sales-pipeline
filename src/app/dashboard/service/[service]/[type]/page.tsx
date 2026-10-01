import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { CONFIG, BUSINESS_TYPES } from '@/lib/config'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { PitchCards } from '@/components/v2/PitchCards'
import { ErrorNote } from '@/components/ui'

export const dynamic = 'force-dynamic'
const PAGE_SIZE = 24

export default async function Page({ params, searchParams }: { params: Promise<{ service: string; type: string }>; searchParams: Promise<{ filter?: string; q?: string; page?: string }> }) {
  const p = await params
  const sp = await searchParams
  const service = decodeURIComponent(p.service)
  const type = decodeURIComponent(p.type)
  if (!(CONFIG.SERVICES as readonly string[]).includes(service) || !BUSINESS_TYPES.includes(type)) notFound()
  const { supabase, profile } = await requireProfile()
  if (!profile) return null
  const page = Math.max(1, parseInt(sp.page || '1') || 1)

  const { data, error } = await supabase.rpc('list_pitches', {
    p_service: service, p_type: type, p_filter: sp.filter || 'all', p_search: sp.q || null,
    p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE,
  })

  return (
    <div className="space-y-5">
      <BreadcrumbSetter breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: service, href: `/dashboard/service/${encodeURIComponent(service)}` }, { label: type }]} />
      <h1>{type}</h1>
      <ErrorNote error={error?.message} />
      <PitchCards
        rows={data || []}
        total={Number(data?.[0]?.total_count ?? 0)}
        page={page}
        pageSize={PAGE_SIZE}
        basePath={`/dashboard/service/${encodeURIComponent(service)}/${encodeURIComponent(type)}`}
        params={sp as Record<string, string | undefined>}
      />
    </div>
  )
}
