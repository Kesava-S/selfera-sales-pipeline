import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardHome } from '@/components/v2/DashboardHome'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  
  // 1. Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Load Dashboard Counts
  const [statusRes, serviceRes] = await Promise.all([
    supabase.rpc('v_dashboard_status_counts', { p_user: user.id }),
    supabase.rpc('v_service_counts', { p_user: user.id })
  ])

  // 3. Load Due Today
  // For Due today, we pull threads that have next_due_on <= today
  // In a real app we'd paginate this, but for the home screen we fetch the top 20
  const { data: dueThreads } = await supabase
    .from('threads')
    .select(`
      id,
      platform,
      step,
      status,
      next_due_on,
      opportunities!inner (
        id,
        stage,
        business_id,
        businesses!inner (
          id,
          business_name,
          business_type
        )
      )
    `)
    .lte('next_due_on', new Date().toISOString().split('T')[0])
    .order('next_due_on', { ascending: true })
    .limit(20)

  return (
    <DashboardHome 
      statusCounts={statusRes.data?.[0] || {}} 
      serviceCounts={serviceRes.data || []}
      dueThreads={dueThreads || []}
    />
  )
}
