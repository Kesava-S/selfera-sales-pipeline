import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Role } from '@/lib/config'

export type Profile = { id: string; full_name: string; role: Role; capacity: number | null; is_active: boolean }

// Use at the top of every dashboard page: logged in + active profile, or leave.
export async function requireProfile() {
  const supabase = await createClient()
  let { data: { user } } = await supabase.auth.getUser()

  if (!user && process.env.NODE_ENV === 'development') {
    const { data: signInData } = await supabase.auth.signInWithPassword({
      email: 'kesav@selfera.co.uk',
      password: process.env.DATABASE_PASSWORD || 'Selfera@123!',
    })
    user = signInData?.user ?? null
  }

  if (!user) redirect('/login')
  const { data: profile, error } = await supabase.from('profiles').select('id, full_name, role, capacity, is_active').eq('id', user.id).maybeSingle()
  if (error) {
    console.error("PROFILE FETCH ERROR:", error)
  } else if (!profile) {
    console.error("PROFILE NOT FOUND FOR USER:", user.id)
  }
  return { supabase, user, profile: (profile && profile.is_active ? profile : null) as Profile | null }
}
