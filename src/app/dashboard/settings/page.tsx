import { requireProfile } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { SettingsView, type Member } from '@/components/v2/SettingsView'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const { supabase, profile } = await requireProfile()
  if (!profile) return null
  const isAdmin = profile.role === 'admin'

  let team: Member[] = []
  let teamNote: string | null = null
  let cadence: { step_name: string; days_delay: number }[] = []

  if (isAdmin) {
    const [{ data: profiles }, { data: rules }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role, capacity, is_active').order('full_name'),
      supabase.from('cadence_rules').select('step_name, days_delay'),
    ])
    cadence = rules || []

    // Emails and invite status live in Supabase Auth (service key, server only)
    const auth = new Map<string, { email: string; invited: boolean }>()
    try {
      const { data, error } = await createServiceClient().auth.admin.listUsers({ perPage: 1000 })
      if (error) throw error
      data.users.forEach(u => auth.set(u.id, { email: u.email || '', invited: !u.email_confirmed_at }))
    } catch {
      teamNote = 'Add SUPABASE_SERVICE_ROLE_KEY to the server settings to see emails and send invites.'
    }
    team = (profiles || []).map(p => ({
      id: p.id, fullName: p.full_name || '', role: p.role, capacity: p.capacity, active: p.is_active,
      email: auth.get(p.id)?.email || '', invited: auth.get(p.id)?.invited ?? false,
    }))
  }

  return (
    <>
      <BreadcrumbSetter breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }]} />
      <SettingsView me={profile} isAdmin={isAdmin} team={team} teamNote={teamNote} cadence={cadence} />
    </>
  )
}
