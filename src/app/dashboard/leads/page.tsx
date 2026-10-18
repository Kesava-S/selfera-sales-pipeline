import { requireProfile } from '@/lib/auth'
import { LeadsManagement } from '@/components/v2/LeadsManagement'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { APPROVAL_QUEUE_TYPES } from '@/lib/config'

export const dynamic = 'force-dynamic'
const PAGE_SIZE_ALL = 25
const PAGE_SIZE_MISSING = 50

type Search = {
  tab?: 'all' | 'review' | 'missing'
  q?: string
  type?: string
  problem?: string
  batch?: string
  service?: string
  stage?: string
  platform?: string
  assigned?: string
  archived?: string
  page?: string
}

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const { supabase, profile } = await requireProfile()
  if (!profile) return null

  const tab = sp.tab === 'missing' ? 'missing' : sp.tab === 'review' ? 'review' : 'all'
  const page = Math.max(1, parseInt(sp.page || '1') || 1)

  // Fetch batches & counts in parallel
  const [
    { data: reviewCountRows },
    { data: overallMissingData },
    { data: filteredMissingData },
    { data: batches },
    { data: staff },
    typeCounts,
  ] = await Promise.all([
    supabase.rpc('list_pitches', { p_filter: 'Needs review', p_limit: 1 }),
    supabase.rpc('missing_counts', { p_type: null, p_problem: null, p_batch: null }),
    tab === 'missing'
      ? supabase.rpc('missing_counts', {
          p_type: sp.type === 'all' ? null : sp.type || null,
          p_problem: sp.problem || null,
          p_batch: sp.batch || null,
        })
      : Promise.resolve({ data: null }),
    supabase.rpc('list_import_batches'),
    supabase.from('profiles').select('id, full_name, role, is_active').eq('is_active', true).order('full_name'),
    Promise.all(
      APPROVAL_QUEUE_TYPES.map(async t => {
        const { data } = await supabase.rpc('list_pitches', {
          p_type: t,
          p_limit: 1,
        })
        return {
          type: t,
          count: Number(data?.[0]?.total_count ?? 0),
        }
      })
    ),
  ])

  let rows: any[] = []
  let missingRows: any[] = []
  let total = 0
  let loadError: string | null = null

  if (tab === 'missing') {
    const { data: mRows, error: mErr } = await supabase.rpc('missing_list', {
      p_type: sp.type === 'all' ? null : sp.type || null,
      p_problem: sp.problem || null,
      p_batch: sp.batch || null,
      p_limit: PAGE_SIZE_MISSING,
      p_offset: (page - 1) * PAGE_SIZE_MISSING,
    })
    if (mErr) loadError = mErr.message
    missingRows = mRows || []
    total = Number(missingRows[0]?.total_count ?? 0)
  } else {
    const { data: pRows, error: pErr } = await supabase.rpc('list_pitches', {
      p_service: sp.service || null,
      p_type: sp.type === 'all' ? null : sp.type || null,
      p_filter: tab === 'review' ? 'Needs review' : sp.stage || 'all',
      p_search: sp.q || null,
      p_platform: tab === 'review' ? null : sp.platform || null,
      p_assigned: sp.assigned || null,
      p_include_archived: sp.archived === '1',
      p_limit: PAGE_SIZE_ALL,
      p_offset: (page - 1) * PAGE_SIZE_ALL,
    })
    if (pErr) loadError = pErr.message
    rows = pRows || []
    total = Number(rows[0]?.total_count ?? 0)
  }

  const typeCountsMap = Object.fromEntries(typeCounts.map(tc => [tc.type, tc.count]))
  const reviewCount = Number(reviewCountRows?.[0]?.total_count ?? 0)
  const missingCount = Number(overallMissingData?.total ?? 0)

  const crumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Lead Management', ...(tab !== 'all' || sp.type ? { href: '/dashboard/leads' } : {}) },
    ...(tab === 'review' ? [{ label: 'Approval queue' }] : []),
    ...(tab === 'missing' ? [{ label: 'Missing data' }] : []),
    ...(tab === 'all' && sp.type ? [{ label: sp.type === 'all' ? 'All business types' : sp.type }] : []),
  ]

  return (
    <>
      <BreadcrumbSetter breadcrumbs={crumbs} />
      <LeadsManagement
        tab={tab}
        rows={rows}
        missingRows={missingRows}
        missingTypes={filteredMissingData?.types ?? overallMissingData?.types ?? []}
        missingProblems={filteredMissingData?.problems ?? overallMissingData?.problems ?? []}
        importBatches={batches || []}
        loadError={loadError}
        total={total}
        reviewCount={reviewCount}
        missingCount={missingCount}
        page={page}
        pageSize={tab === 'missing' ? PAGE_SIZE_MISSING : PAGE_SIZE_ALL}
        params={sp as Record<string, string | undefined>}
        role={profile.role}
        staff={(staff || []).filter(s => s.role !== 'consultant')}
        typeCounts={typeCountsMap}
      />
    </>
  )
}
