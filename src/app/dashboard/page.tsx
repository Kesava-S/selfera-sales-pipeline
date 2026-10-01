import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardHome } from '@/components/v2/DashboardHome'
export const dynamic = 'force-dynamic'

import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'

const OPEN_STAGES = ['Active', 'Interested', 'Consultation']

const THREAD_FIELDS = `
  id,
  platform,
  step,
  status,
  next_due_on,
  last_inbound_at,
  last_outbound_at,
  opportunities!inner (
    id,
    stage,
    business_id,
    businesses (
      id,
      business_name,
      business_type
    )
  )
`

export default async function Page() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().slice(0, 10)

  const [statusRes, serviceRes, dueRes, repliedRes] = await Promise.all([
    supabase.rpc('v_dashboard_status_counts', { p_user: user.id }),
    supabase.rpc('v_service_counts', { p_user: user.id }),
    // New outreach and follow-ups due today or overdue
    supabase
      .from('threads')
      .select(THREAD_FIELDS)
      .lte('next_due_on', today)
      .in('status', ['Not contacted', 'Awaiting reply'])
      .order('next_due_on', { ascending: true })
      .limit(200),
    // Replies waiting for us
    supabase
      .from('threads')
      .select(THREAD_FIELDS)
      .eq('status', 'Replied')
      .limit(200),
  ])

  const replies = (repliedRes.data || []).filter((t: any) =>
    OPEN_STAGES.includes(t.opportunities?.stage) &&
    t.last_inbound_at &&
    (!t.last_outbound_at || t.last_inbound_at > t.last_outbound_at)
  )

  const dueThreads = [
    ...(dueRes.data || []).filter((t: any) => OPEN_STAGES.includes(t.opportunities?.stage)),
    ...replies,
  ]

  return (
    <>
      <BreadcrumbSetter breadcrumbs={[{ label: 'Dashboard' }]} />
      <DashboardHome
        statusCounts={statusRes.data?.[0] || {}}
        serviceCounts={serviceRes.data || []}
        dueThreads={dueThreads}
      />
    </>
  )
}
