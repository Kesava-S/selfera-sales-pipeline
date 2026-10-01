'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Sign-in only. New staff are invited by an admin in Supabase (no public sign-up).
export async function login(formData: FormData) {
  const supabase = await createClient()
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')
  if (!email || !password) redirect('/login?error=' + encodeURIComponent('Enter your email and password.'))

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) redirect('/login?error=' + encodeURIComponent('Wrong email or password.'))

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
