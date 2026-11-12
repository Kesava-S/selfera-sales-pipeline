import { requireProfile, getDashboardStatusCounts } from '@/lib/auth'
import { LeadsManagement } from '@/components/v2/LeadsManagement'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { getSalesLists } from '@/lib/dynamicData'

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

  // Fetch batches & counts in parallel - only query what's needed for the active tab
  const [
    statusCounts,
    overallMissingResult,
    filteredMissingResult,
    batchesResult,
    { data: staff },
    typeCounts,
    { count: unassignedOpen },
    { data: lateReplyRows },
  ] = await Promise.all([
    getDashboardStatusCounts(supabase, profile.id),
    supabase.rpc('missing_counts', { p_type: null, p_problem: null, p_batch: null }),
    tab === 'missing'
      ? supabase.rpc('missing_counts', {
          p_type: sp.type === 'all' ? null : sp.type || null,
          p_problem: sp.problem || null,
          p_batch: sp.batch || null,
        })
      : Promise.resolve({ data: null }),
    tab === 'missing'
      ? supabase.rpc('list_import_batches')
      : Promise.resolve({ data: [] }),
    supabase.from('profiles').select('id, full_name, role, is_active').eq('is_active', true).order('full_name'),
    tab === 'all'
      ? (async () => {
          const lists = await getSalesLists()
          const { data } = await supabase
            .from('opportunities')
            .select('businesses!inner(business_type, archived)')
            .neq('stage', 'Needs review')
            .eq('businesses.archived', false)
          const counts: Record<string, number> = {}
          data?.forEach((r: any) => {
            const bt = r.businesses?.business_type
            if (bt) counts[bt] = (counts[bt] || 0) + 1
          })
          return lists.categories.map(c => ({ type: c.name, count: counts[c.name] ?? 0 }))
        })()
      : Promise.resolve([]),
    // Approved pitches nobody is working on (admins see a warning)
    tab === 'all' && profile.role === 'admin'
      ? supabase.from('opportunities').select('id', { count: 'exact', head: true }).in('stage', ['Active', 'Interested']).is('assigned_sales_id', null)
      : Promise.resolve({ count: 0 }),
    // Closed leads that wrote back (a short list), fetched alongside rather than after the page
    tab === 'all'
      ? supabase.from('opportunities').select('id').not('replied_after_close_at', 'is', null).limit(1000)
      : Promise.resolve({ data: [] }),
  ])

  const overallMissingData = overallMissingResult.data
  const filteredMissingData = filteredMissingResult.data
  const batches = batchesResult.data || []

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

  // Email check results and off-target marks (kept on businesses; the list functions don't return them)
  const businessIds = [...new Set([...rows, ...missingRows].map(r => r.business_id).filter(Boolean))]
  const { data: emailRows } = businessIds.length
    ? await supabase.from('businesses').select('id, email_status, email_reason, email_suggestion, email_role, off_target_at, off_target_reason, off_target_noticed, off_target_note').in('id', businessIds)
    : { data: [] as { id: string }[] }
  const emailById = new Map((emailRows || []).map(({ id, ...check }) => [id, check]))

  // Latest reply's type per lead (sorted by word rules; a label only)
  const oppIds = rows.map(r => r.opportunity_id).filter(Boolean)
  const { data: replyThreads } = oppIds.length
    ? await supabase.from('threads').select('opportunity_id, last_reply_intent, last_inbound_at').in('opportunity_id', oppIds)
      .not('last_reply_intent', 'is', null).order('last_inbound_at', { ascending: false, nullsFirst: false })
    : { data: [] as { opportunity_id: string; last_reply_intent: string | null }[] }
  const replyByOpp = new Map<string, string>()
  for (const t of replyThreads || []) if (t.last_reply_intent && !replyByOpp.has(t.opportunity_id)) replyByOpp.set(t.opportunity_id, t.last_reply_intent)
  rows = rows.map(r => ({ ...r, ...emailById.get(r.business_id), reply_intent: replyByOpp.get(r.opportunity_id) ?? null }))
  missingRows = missingRows.map(r => ({ ...r, ...emailById.get(r.business_id) }))

  // Closed leads that wrote back (staff decide whether to reopen)
  const lateReplies: string[] = (lateReplyRows || []).map(r => r.id)

  const typeCountsMap = Object.fromEntries(typeCounts.map(tc => [tc.type, tc.count]))
  const reviewCount = tab === 'review' ? total : Number(statusCounts?.data?.[0]?.needs_review ?? 0)
  const missingCount = tab === 'missing' ? total : Number(overallMissingData?.total ?? 0)
  const allCount = tab === 'all' ? total : Number(statusCounts?.data?.[0]?.total_pitches ?? 0)

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
        allCount={allCount}
        reviewCount={reviewCount}
        missingCount={missingCount}
        page={page}
        pageSize={tab === 'missing' ? PAGE_SIZE_MISSING : PAGE_SIZE_ALL}
        params={sp as Record<string, string | undefined>}
        role={profile.role}
        staff={(staff || []).filter(s => s.role !== 'consultant')}
        typeCounts={typeCountsMap}
        unassignedOpen={unassignedOpen ?? 0}
        lateReplies={lateReplies}
      />
    </>
  )
}
