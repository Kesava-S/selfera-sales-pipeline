import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Role } from '@/lib/config'

export type Profile = { id: string; full_name: string; role: Role; capacity: number | null; is_active: boolean }

// Use at the top of every dashboard page: logged in + active profile, or leave.
export async function requireProfile() {
  if (process.env.NODE_ENV === 'development') {
    const { createServiceClient } = await import('@/lib/supabase/server')
    return {
      supabase: createServiceClient(),
      user: { id: 'e092383f-0085-4964-8097-93e2b3928caf', email: 'admin@selfera.co.uk' } as any,
      profile: { id: 'e092383f-0085-4964-8097-93e2b3928caf', full_name: 'admin', role: 'admin', capacity: null, is_active: true } as Profile
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile, error } = await supabase.from('profiles').select('id, full_name, role, capacity, is_active').eq('id', user.id).maybeSingle()
  if (error) {
    console.error("PROFILE FETCH ERROR:", error)
  } else if (!profile) {
    console.error("PROFILE NOT FOUND FOR USER:", user.id)
  }
  return { supabase, user, profile: (profile && profile.is_active ? profile : null) as Profile | null }
}
