import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Role } from '@/lib/config'

export type Profile = {
  id: string
  full_name: string
  role: Role
  capacity: number | null
  is_active: boolean
  company_role?: string | null
  display_role?: string
}

export function formatRoleTitle(companyRole?: string | null, salesRole?: Role): string {
  if (companyRole === 'founder') return 'Founder'
  if (companyRole === 'team_lead') return salesRole === 'consultant' ? 'Team Lead (Consultant)' : 'Team Lead (Sales)'
  if (companyRole === 'uk_staff') return 'UK Operations (Sales)'
  if (companyRole === 'full_time') return 'Sales Executive'
  if (companyRole === 'intern') return 'Sales Intern'
  if (salesRole === 'admin') return 'Pipeline Administrator'
  if (salesRole === 'consultant') return 'Consultant'
  return 'Sales Representative'
}

const getCachedCompanyRole = unstable_cache(
  async (userId: string, email: string): Promise<string | null> => {
    try {
      const service = createServiceClient()
      const { data: emp } = await service
        .schema('hr')
        .from('employees')
        .select('role_id')
        .or(`auth_user_id.eq.${userId},email.ilike.${email || ''}`)
        .maybeSingle()

      if (emp?.role_id) {
        const { data: roleRow } = await service
          .schema('public')
          .from('roles')
          .select('name')
          .eq('id', emp.role_id)
          .maybeSingle()
        return roleRow?.name ?? null
      }
      return null
    } catch (err) {
      console.warn('[getCachedCompanyRole] Could not fetch company role:', err)
      return null
    }
  },
  ['user-company-role'],
  { revalidate: 300 }
)

export const requireProfile = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, capacity, is_active')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[requireProfile] Profile fetch error:', error)
  }

  if (!profile || !profile.is_active) {
    console.warn('[requireProfile] Profile missing or inactive for user:', user.id)
    redirect('/login?error=' + encodeURIComponent('Your account is not active. Please contact an administrator.'))
  }

  const companyRole = await getCachedCompanyRole(user.id, user.email || '')
  const display_role = formatRoleTitle(companyRole, profile.role)

  return {
    supabase,
    user,
    profile: {
      ...profile,
      company_role: companyRole,
      display_role,
    } as Profile,
  }
})

export const getDashboardStatusCounts = cache(async (supabase: any, userId: string) => {
  return await supabase.rpc('v_dashboard_status_counts', { p_user: userId })
})
