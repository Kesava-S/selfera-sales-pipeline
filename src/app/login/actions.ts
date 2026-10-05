'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { validateAndSyncUserAccess } from '@/lib/auth-service'

export interface LoginActionResult {
  success: boolean
  error?: string
}

export async function login(formData: FormData): Promise<void> {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')
  const next = String(formData.get('next') || '/dashboard')

  if (!email || !password) {
    redirect('/login?error=' + encodeURIComponent('Please enter your email and password.'))
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError || !authData?.user) {
    redirect('/login?error=' + encodeURIComponent('Invalid email or password.'))
  }

  const headerList = await headers()
  const ipAddress = headerList.get('x-forwarded-for') || headerList.get('x-real-ip') || '127.0.0.1'
  const userAgent = headerList.get('user-agent') || ''

  const validation = await validateAndSyncUserAccess({
    userId: authData.user.id,
    email: authData.user.email || email,
    ipAddress,
    userAgent,
  })

  if (!validation.ok) {
    await supabase.auth.signOut()
    redirect('/login?error=' + encodeURIComponent(validation.error || 'Access denied.'))
  }

  revalidatePath('/', 'layout')
  redirect(next.startsWith('/') ? next : '/dashboard')
}

export async function loginAjax(emailInput: string, passwordInput: string, nextInput?: string): Promise<LoginActionResult> {
  const email = String(emailInput || '').trim()
  const password = String(passwordInput || '')

  if (!email || !password) {
    return { success: false, error: 'Please enter your email and password.' }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError || !authData?.user) {
    return { success: false, error: 'Invalid email or password.' }
  }

  const headerList = await headers()
  const ipAddress = headerList.get('x-forwarded-for') || headerList.get('x-real-ip') || '127.0.0.1'
  const userAgent = headerList.get('user-agent') || ''

  const validation = await validateAndSyncUserAccess({
    userId: authData.user.id,
    email: authData.user.email || email,
    ipAddress,
    userAgent,
  })

  if (!validation.ok) {
    await supabase.auth.signOut()
    return { success: false, error: validation.error || 'Access denied.' }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}
