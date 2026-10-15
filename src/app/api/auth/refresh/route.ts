import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const refreshToken =
    cookieStore.get('refreshToken')?.value ||
    cookieStore.get('selfera_refresh_token')?.value

  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token provided.' }, { status: 401 })
  }

  const issuerUrl = process.env.OIDC_ISSUER_URL || 'http://localhost:3001'
  const clientId = process.env.OIDC_CLIENT_ID
  const clientSecret = process.env.OIDC_CLIENT_SECRET

  // 1. Attempt OIDC IdP refresh
  if (clientId && clientSecret) {
    try {
      const oidcRes = await fetch(`${issuerUrl}/api/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      })

      if (oidcRes.ok) {
      const data = await oidcRes.json()
      const newRefreshToken = data.refresh_token || refreshToken
      const parts = data.id_token.split('.')
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))

      const res = NextResponse.json({ success: true, email: payload.email })
      const isProd = process.env.NODE_ENV === 'production'

      res.cookies.set('refreshToken', newRefreshToken, {
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        sameSite: 'lax',
        httpOnly: true,
        secure: isProd,
      })
      res.cookies.set('selfera_refresh_token', newRefreshToken, {
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        sameSite: 'lax',
        httpOnly: true,
        secure: isProd,
      })

      return res
    }
  } catch (err: any) {
    console.warn('[Refresh] OIDC IdP refresh non-fatal error:', err.message)
  }
}

  // 2. Fallback to shared.refresh_tokens table check
  try {
    const service = createServiceClient()
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')

    const { data: tokenRecord, error: selectErr } = await service
      .schema('shared')
      .from('refresh_tokens')
      .select('id, employee_id, revoked, expires_at, session_id, session_started_at, last_activity_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (selectErr || !tokenRecord) {
      return NextResponse.json({ error: 'Invalid refresh token.' }, { status: 401 })
    }

    if (tokenRecord.revoked) {
      if (tokenRecord.session_id) {
        await service
          .schema('shared')
          .from('refresh_tokens')
          .update({ revoked: true, revoked_at: new Date().toISOString(), revoked_reason: 'reuse_detected' })
          .eq('session_id', tokenRecord.session_id)
      }
      return NextResponse.json({ error: 'Revoked refresh token reuse detected.' }, { status: 401 })
    }

    const now = new Date()
    if (new Date(tokenRecord.expires_at) < now) {
      return NextResponse.json({ error: 'Refresh token has expired.' }, { status: 401 })
    }

    // Inactivity timeout (7 days)
    const lastActivity = new Date(tokenRecord.last_activity_at || tokenRecord.session_started_at)
    if (now.getTime() - lastActivity.getTime() > 7 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Session expired due to inactivity.' }, { status: 401 })
    }

    // Absolute timeout (30 days)
    const sessionStarted = new Date(tokenRecord.session_started_at || lastActivity)
    if (now.getTime() - sessionStarted.getTime() > 30 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Maximum session duration reached (30 days).' }, { status: 401 })
    }

    // Token rotation: mark old revoked, insert new
    await service
      .schema('shared')
      .from('refresh_tokens')
      .update({ revoked: true, revoked_at: now.toISOString(), revoked_reason: 'rotated' })
      .eq('id', tokenRecord.id)

    const newRawRefreshToken = crypto.randomBytes(40).toString('hex')
    const newTokenHash = crypto.createHash('sha256').update(newRawRefreshToken).digest('hex')

    await service
      .schema('shared')
      .from('refresh_tokens')
      .insert({
        employee_id: tokenRecord.employee_id,
        token_hash: newTokenHash,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        session_id: tokenRecord.session_id,
        session_started_at: sessionStarted.toISOString(),
        last_activity_at: now.toISOString(),
      })

    const res = NextResponse.json({ success: true })
    const isProd = process.env.NODE_ENV === 'production'

    res.cookies.set('refreshToken', newRawRefreshToken, {
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      sameSite: 'lax',
      httpOnly: true,
      secure: isProd,
    })
    res.cookies.set('selfera_refresh_token', newRawRefreshToken, {
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      sameSite: 'lax',
      httpOnly: true,
      secure: isProd,
    })

    return res
  } catch (dbErr: any) {
    console.error('[Refresh] DB error:', dbErr)
    return NextResponse.json({ error: 'Refresh failed.' }, { status: 500 })
  }
}
