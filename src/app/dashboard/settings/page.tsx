import { requireProfile } from '@/lib/auth'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { SettingsView, type OptOut, type TeamMember } from '@/components/v2/SettingsView'
import { createServiceClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const { supabase, profile } = await requireProfile()
  if (!profile) return null
  const isAdmin = profile.role === 'admin'

  let cadence: { step_name: string; days_delay: number }[] = []
  let optOuts: OptOut[] = []
  let teamMembers: TeamMember[] = []

  if (isAdmin) {
    const service = createServiceClient()
    const [{ data: rules }, { data: blocked }, { data: profilesData }, authUsersRes, employeesRes] = await Promise.all([
      supabase.from('cadence_rules').select('step_name, days_delay'),
      supabase.from('opt_outs').select('id, identifier, channel, reason, source, created_at').order('created_at', { ascending: false }).limit(500),
      supabase.from('profiles').select('id, full_name, role, is_active, created_at').order('created_at', { ascending: false }),
      service.auth.admin.listUsers({ perPage: 100 }).catch(err => {
        console.warn('[SettingsPage] Error querying auth.users:', err)
        return { data: { users: [] }, error: err }
      }),
      service.schema('hr').from('employees').select('auth_user_id, email'),
    ])
    cadence = rules || []

    const adminPanelAuthIds = new Set((employeesRes?.data || []).map((e: any) => e.auth_user_id).filter(Boolean))
    const adminPanelEmails = new Set((employeesRes?.data || []).map((e: any) => e.email?.toLowerCase()).filter(Boolean))

    // Name the business behind each blocked address, where we know it
    const emails = [...new Set((blocked || []).map(o => o.identifier.toLowerCase()).filter(x => x.includes('@')))]
    const names = new Map<string, string>()
    if (emails.length) {
      const { data: biz } = await supabase.from('businesses').select('business_name, email').in('email', emails)
      biz?.forEach(b => b.email && names.set(b.email.toLowerCase(), b.business_name))
    }
    optOuts = (blocked || []).map(o => ({
      id: o.id, identifier: o.identifier, channel: o.channel, reason: o.reason, source: o.source,
      createdAt: o.created_at, business: names.get(o.identifier.toLowerCase()) ?? null,
    }))

    // Build real team members & pending invites
    const authUsers = authUsersRes?.data?.users || []
    const authMap = new Map(authUsers.map(u => [u.id, u]))
    const profileIds = new Set((profilesData || []).map(p => p.id))

    const activeList: TeamMember[] = (profilesData || []).map(p => {
      const u = authMap.get(p.id)
      const isPasswordSet = !!u?.user_metadata?.password_set
      const isPending = !p.is_active && (!isPasswordSet || !!u?.invited_at)
      const status: 'active' | 'pending' | 'inactive' = p.is_active
        ? 'active'
        : (isPending ? 'pending' : 'inactive')

      const email = (u?.email || '').toLowerCase()
      const isFromAdminPanel = adminPanelAuthIds.has(p.id) || (email ? adminPanelEmails.has(email) : false)
      const source: 'admin_panel' | 'sales_direct' = isFromAdminPanel ? 'admin_panel' : 'sales_direct'

      return {
        id: p.id,
        name: p.full_name || 'Team Member',
        email: u?.email || '',
        role: p.role,
        status,
        source,
        joinedOrInvitedAt: status === 'pending'
          ? `Invited ${formatDate(u?.invited_at || p.created_at)}`
          : `Joined ${formatDate(p.created_at)}`,
      }
    })

    // Include any invited users from auth.users who do not have a profiles record yet
    const pendingWithoutProfile: TeamMember[] = authUsers
      .filter(u => !profileIds.has(u.id) && (u.invited_at || !u.user_metadata?.password_set))
      .map(u => {
        const email = (u.email || '').toLowerCase()
        const isFromAdminPanel = adminPanelAuthIds.has(u.id) || (email ? adminPanelEmails.has(email) : false)
        const source: 'admin_panel' | 'sales_direct' = isFromAdminPanel ? 'admin_panel' : 'sales_direct'

        return {
          id: u.id,
          name: (u.user_metadata?.full_name as string) || u.email?.split('@')[0] || 'Invited User',
          email: u.email || '',
          role: (u.user_metadata?.role as any) || 'sales',
          status: 'pending' as const,
          source,
          joinedOrInvitedAt: `Invited ${formatDate(u.invited_at || u.created_at)}`,
        }
      })

    teamMembers = [...activeList, ...pendingWithoutProfile]
  }

  return (
    <>
      <BreadcrumbSetter breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }]} />
      <SettingsView
        me={profile}
        isAdmin={isAdmin}
        cadence={cadence}
        optOuts={optOuts}
        initialTeamMembers={teamMembers}
      />
    </>
  )
}
