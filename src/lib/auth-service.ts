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

const NO_ACCESS = "You don't have access to the Sales Pipeline. Ask an admin to give you access in the Admin Panel."

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

    // Only Selfera employees use the Sales Pipeline; access is given in the Admin Panel
    if (!employee) {
      return { ok: false, error: NO_ACCESS }
    }
    // Same rule as the Admin Panel's sign-in
    if (employee.status === 'terminated') {
      return { ok: false, error: 'Your account has been deactivated. Please contact HR.' }
    }

    if (!employee.auth_user_id) {
      try {
        // Linking the account also creates their Sales profile (database trigger)
        await service
          .schema('hr')
          .from('employees')
          .update({ auth_user_id: userId })
          .eq('id', employee.id)
      } catch (e: any) {
        console.warn('[AuthService] Failed to link auth_user_id:', e)
      }
    }

    // Brings role and on/off in line with the Access matrix
    const { error: syncErr } = await service
      .schema('sales-pipe')
      .rpc('sync_profile_from_matrix', { p_employee_id: employee.id })
    if (syncErr) {
      console.error('[AuthService] Profile sync error:', syncErr.message)
    }

    // Keep public.users in sync for public.current_user_role() and RLS
    try {
      await service
        .schema('public')
        .from('users')
        .upsert({
          user_id: userId,
          email: email.toLowerCase(),
          full_name: employee.full_name || email.split('@')[0],
          role_id: employee.role_id,
          is_active: true,
        }, { onConflict: 'email' })
    } catch (pubSyncErr) {
      console.warn('[AuthService] Non-fatal public.users sync warning:', pubSyncErr)
    }

    const { data: activeProfile } = await service
      .schema('sales-pipe')
      .from('profiles')
      .select('id, full_name, role, is_active')
      .eq('id', userId)
      .maybeSingle()

    if (!activeProfile?.is_active) {
      return { ok: false, error: NO_ACCESS }
    }

    try {
      await service
        .schema('shared')
        .from('user_activity_logs')
        .insert({
          employee_id: employee.id,
          action: 'login',
          entity: 'sales_pipeline',
          ip_address: ipAddress.split(',')[0].trim(),
          user_agent: userAgent,
          meta: {
            email,
            role_id: employee.role_id,
            sales_role: activeProfile.role,
            product: 'sales_pipeline',
          },
        })
    } catch (logErr) {
      console.warn('[AuthService] Failed to write to shared.user_activity_logs:', logErr)
    }

    return {
      ok: true,
      employee,
      profile: activeProfile,
    }
  } catch (err: any) {
    console.error('[AuthService] Unexpected error during validation:', err)
    return {
      ok: false,
      error: 'An unexpected authentication error occurred. Please try again.',
    }
  }
}
