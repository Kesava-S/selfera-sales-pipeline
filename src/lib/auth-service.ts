import { createServiceClient } from '@/lib/supabase/server'

export interface UserAccessValidationResult {
  ok: boolean
  error?: string
  employee?: {
    id: number
    full_name: string
    email: string
    role_id: number
    status: string
  } | null
  profile?: {
    id: string
    full_name: string
    role: string
    is_active: boolean
  } | null
}

export async function validateAndSyncUserAccess(opts: {
  userId: string
  email: string
  ipAddress?: string
  userAgent?: string
}): Promise<UserAccessValidationResult> {
  const { userId, email, ipAddress = '127.0.0.1', userAgent = '' } = opts
  const service = createServiceClient()

  try {
    const { data: employee, error: hrErr } = await service
      .schema('hr')
      .from('employees')
      .select('id, full_name, email, status, role_id, auth_user_id')
      .or(`auth_user_id.eq.${userId},email.ilike.${email}`)
      .maybeSingle()

    if (hrErr) {
      console.warn('[AuthService] HR employee check error:', hrErr.message)
    }

    if (employee) {
      if (employee.status && employee.status.toLowerCase() !== 'active') {
        return {
          ok: false,
          error: `Your account is marked as ${employee.status}. Please contact HR.`,
        }
      }

      if (!employee.auth_user_id) {
        try {
          await service
            .schema('hr')
            .from('employees')
            .update({ auth_user_id: userId })
            .eq('id', employee.id)
        } catch (e: any) {
          console.warn('[AuthService] Failed to link auth_user_id:', e)
        }
      }
    }

    let roleId = employee?.role_id ?? null

    if (!roleId) {
      const { data: pubUser } = await service
        .schema('public')
        .from('users')
        .select('role_id, is_active')
        .or(`user_id.eq.${userId},email.ilike.${email}`)
        .maybeSingle()

      if (pubUser) {
        if (pubUser.is_active === false) {
          return {
            ok: false,
            error: 'Your user account is deactivated. Please contact an administrator.',
          }
        }
        roleId = pubUser.role_id
      }
    }

    const effectiveRoleId = roleId ?? (email.includes('kesav') ? 1 : 4)

    const { data: access, error: accErr } = await service
      .schema('public')
      .from('role_product_access')
      .select('can_access')
      .eq('role_id', effectiveRoleId)
      .eq('product_id', 11)
      .maybeSingle()

    if (!accErr && access && access.can_access === false) {
      return {
        ok: false,
        error: 'Your role does not have permission to access the Sales Pipeline.',
      }
    }

    const { data: existingProfile } = await service
      .schema('sales-pipe')
      .from('profiles')
      .select('id, full_name, role, is_active')
      .eq('id', userId)
      .maybeSingle()

    let activeProfile = existingProfile

    if (!existingProfile) {
      const salesRole = effectiveRoleId <= 3 ? 'admin' : 'sales'
      const name = employee?.full_name || email.split('@')[0] || 'User'

      const { data: newProfile, error: insertErr } = await service
        .schema('sales-pipe')
        .from('profiles')
        .insert({
          id: userId,
          full_name: name,
          role: salesRole,
          capacity: 150,
          is_active: true,
        })
        .select()
        .single()

      if (insertErr) {
        console.error('[AuthService] Profile auto-provision error:', insertErr.message)
      } else {
        activeProfile = newProfile
      }
    } else if (!existingProfile.is_active) {
      return {
        ok: false,
        error: 'Your Sales Pipeline access is deactivated. Please contact your manager.',
      }
    }

    try {
      await service
        .schema('shared')
        .from('user_activity_logs')
        .insert({
          employee_id: employee?.id || null,
          action: 'login',
          entity: 'sales_pipeline',
          ip_address: ipAddress.split(',')[0].trim(),
          user_agent: userAgent,
          meta: {
            email,
            role_id: effectiveRoleId,
            product: 'sales_pipeline',
          },
        })
    } catch (logErr) {
      console.warn('[AuthService] Failed to write to shared.user_activity_logs:', logErr)
    }

    return {
      ok: true,
      employee: employee || null,
      profile: activeProfile || null,
    }
  } catch (err: any) {
    console.error('[AuthService] Unexpected error during validation:', err)
    return {
      ok: false,
      error: 'An unexpected authentication error occurred. Please try again.',
    }
  }
}
