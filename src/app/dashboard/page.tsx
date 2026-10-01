import { requireProfile } from '@/lib/auth'
import { DashboardHome } from '@/components/v2/DashboardHome'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const { supabase, user, profile } = await requireProfile()
  if (!profile) return null

  const [status, services, newOutreach, followUps, replies] = await Promise.all([
    supabase.rpc('v_dashboard_status_counts', { p_user: user.id }),
    supabase.rpc('v_service_counts', { p_user: user.id }),
    supabase.rpc('v_due_today', { p_tab: 'New outreach', p_limit: 200 }),
    supabase.rpc('v_due_today', { p_tab: 'Follow-ups', p_limit: 200 }),
    supabase.rpc('v_due_today', { p_tab: 'Replies', p_limit: 200 }),
  ])
  const loadError = [status, services, newOutreach, followUps, replies].find(r => r.error)?.error?.message ?? null

  return (
    <>
      <BreadcrumbSetter breadcrumbs={[{ label: 'Dashboard' }]} />
      <DashboardHome
        name={profile.full_name.split(' ')[0]}
        role={profile.role}
        counts={status.data?.[0] ?? {}}
        services={services.data ?? []}
        due={{ new: newOutreach.data ?? [], followups: followUps.data ?? [], replies: replies.data ?? [] }}
        loadError={loadError}
      />
    </>
  )
}
