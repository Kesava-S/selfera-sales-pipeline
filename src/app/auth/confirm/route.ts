import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = (searchParams.get('type') || 'invite') as EmailOtpType
  const next = searchParams.get('next') || '/auth/set-password'

  const redirectTo = request.nextUrl.clone()
  redirectTo.pathname = next
  redirectTo.search = ''

  if (token_hash) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    })

    if (!error) {
      // Successfully authenticated & verified invite.
      // Next.js cookieStore automatically persists session cookies in this route handler.
      return NextResponse.redirect(redirectTo)
    }

    console.error('[auth/confirm] OTP verification error:', error.message)
  }

  // If token is invalid or missing, redirect to set-password with error flag
  redirectTo.pathname = '/auth/set-password'
  redirectTo.searchParams.set('error', 'invalid_token')
  return NextResponse.redirect(redirectTo)
}

