import { requireProfile } from '@/lib/auth'
import { LeadsManagement } from '@/components/v2/LeadsManagement'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'

export const dynamic = 'force-dynamic'
const PAGE_SIZE = 25

type Search = { tab?: string; q?: string; type?: string; service?: string; stage?: string; platform?: string; assigned?: string; archived?: string; page?: string }

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const { supabase, profile } = await requireProfile()
  if (!profile) return null

  const tab = sp.tab === 'review' ? 'review' : 'all'
  const page = Math.max(1, parseInt(sp.page || '1') || 1)

  const [{ data: rows, error }, { data: reviewCountRows }, { data: staff }] = await Promise.all([
    supabase.rpc('list_pitches', {
      p_service: sp.service || null,
      p_type: sp.type || null,
      p_filter: tab === 'review' ? 'Needs review' : sp.stage || 'all',
      p_search: sp.q || null,
      p_platform: tab === 'review' ? null : sp.platform || null,
      p_assigned: sp.assigned || null,
      p_include_archived: sp.archived === '1',
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    }),
    supabase.rpc('list_pitches', { p_filter: 'Needs review', p_limit: 1 }),
    supabase.from('profiles').select('id, full_name, role, is_active').eq('is_active', true).order('full_name'),
  ])

  return (
    <>
      <BreadcrumbSetter breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Lead Management' }]} />
      <LeadsManagement
        tab={tab}
        rows={rows || []}
        loadError={error?.message ?? null}
        total={Number(rows?.[0]?.total_count ?? 0)}
        reviewCount={Number(reviewCountRows?.[0]?.total_count ?? 0)}
        page={page}
        pageSize={PAGE_SIZE}
        params={sp as Record<string, string | undefined>}
        role={profile.role}
        staff={(staff || []).filter(s => s.role !== 'consultant')}
      />
    </>
  )
}
