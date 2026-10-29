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
  email?: string
}

export function formatRoleTitle(companyRole?: string | null, salesRole?: Role): string {
  if (companyRole === 'founder') return 'Founder'
  if (salesRole === 'admin') return 'Admin'
  if (salesRole === 'consultant') return 'Consultant'
  return 'Sales'
}

export const getCachedProductRole = unstable_cache(
  async (userId: string, email: string, salesRole?: Role): Promise<string> => {
    try {
      const service = createServiceClient()

      // 1. Try to get role from user_product_access for Sales Pipeline
      const { data: emp } = await service
        .schema('hr')
        .from('employees')
        .select('id')
        .or(`auth_user_id.eq.${userId},email.ilike.${email || ''}`)
        .maybeSingle()

      if (emp?.id) {
        const { data: access } = await service
          .schema('public')
          .from('user_product_access')
          .select('product_roles(name, code), products!inner(code)')
          .eq('employee_id', emp.id)
          .eq('products.code', 'sales_pipeline')
          .maybeSingle()

        const rawPr = access?.product_roles
        const pr = (Array.isArray(rawPr) ? rawPr[0] : rawPr) as { name?: string; code?: string } | null | undefined
        if (pr?.name) {
          return pr.name
        }
      }

      // 2. Direct lookup from public.product_roles by role code
      const { data: roleRow } = await service
        .schema('public')
        .from('product_roles')
        .select('name, products!inner(code)')
        .eq('products.code', 'sales_pipeline')
        .eq('code', salesRole || 'sales')
        .maybeSingle()

      if (roleRow?.name) {
        return roleRow.name
      }

      return formatRoleTitle(null, salesRole)
    } catch (err) {
      console.warn('[getCachedProductRole] Could not fetch role from product_roles:', err)
      return formatRoleTitle(null, salesRole)
    }
  },
  ['user-product-role'],
  { revalidate: 300 }
)

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

// The signed-in person, from the login token. The token is checked locally against the
// project's public signing key, so this costs no call to Supabase Auth.
export const requireUser = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) {
    redirect('/login')
  }
  return { supabase, user: { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : undefined } }
})

export const requireProfile = cache(async () => {
  const { supabase, user } = await requireUser()

  const [{ data: profile, error }, companyRole] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, role, capacity, is_active')
      .eq('id', user.id)
      .maybeSingle(),
    getCachedCompanyRole(user.id, user.email || ''),
  ])

  if (error) {
    console.error('[requireProfile] Profile fetch error:', error)
  }

  if (!profile || !profile.is_active) {
    console.warn('[requireProfile] Profile missing or inactive for user:', user.id)
    redirect('/login?error=' + encodeURIComponent('Your account is not active. Please contact an administrator.'))
  }

  const display_role = companyRole === 'founder'
    ? 'Founder'
    : await getCachedProductRole(user.id, user.email || '', profile.role)

  return {
    supabase,
    user,
    profile: {
      ...profile,
      email: user.email,
      company_role: companyRole,
      display_role,
    } as Profile,
  }
})

export const getDashboardStatusCounts = cache(async (supabase: any, userId: string) => {
  return await supabase.rpc('v_dashboard_status_counts', { p_user: userId })
})
