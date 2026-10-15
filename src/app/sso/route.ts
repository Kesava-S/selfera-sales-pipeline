import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { validateAndSyncUserAccess } from '@/lib/auth-service'

export const dynamic = "force-dynamic";

function getCandidateSecrets(): string[] {
  return [
    process.env.SSO_SHARED_SECRET,
    process.env.OIDC_CLIENT_SECRET,
    process.env.JWT_SECRET,
    process.env.JWT_ACCESS_SECRET,
  ].filter(Boolean) as string[]
}

function verifyToken(token: string): any | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [h, p, s] = parts

  const candidateSecrets = getCandidateSecrets()
  if (candidateSecrets.length === 0) {
    console.error('[SSO] No candidate secrets configured in environment variables.')
    return null
  }

  for (const secret of candidateSecrets) {
    try {
      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(`${h}.${p}`)
        .digest('base64url')

      if (
        s.length === expectedSig.length &&
        crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expectedSig))
      ) {
        const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'))
        if (payload.exp && Date.now() >= payload.exp * 1000) {
          continue
        }
        return payload
      }
    } catch {
      // try next candidate
    }
  }
  return null
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const token = searchParams.get('token')
  const redirectPath = searchParams.get('redirect') || '/dashboard'

  if (!code && !token) {
    return NextResponse.redirect(new URL('/login?error=MissingSSOToken', request.url))
  }

  // In production, check referer if present (allow trusted Selfera and Automaitee admin domains)
  const TRUSTED_ADMIN_DOMAINS = [
    "admin.selfera.co.uk",
    "selfera-admin",
    "automaitee-admin",
    "vercel.app",
    "localhost",
  ];

  if (process.env.NODE_ENV === 'production') {
    const referer = request.headers.get('referer') || ''
    if (referer && !TRUSTED_ADMIN_DOMAINS.some((domain) => referer.includes(domain))) {
      console.warn(`SSO blocked: Untrusted referer in production (${referer})`)
      return NextResponse.redirect(new URL('/login?error=UnauthorizedSource', request.url))
    }
  }

  let oidcRefreshToken: string | null = null
  let payload: any = null

  try {
    // 1. OIDC Authorization Code Flow
    if (code) {
      const rawIssuer = process.env.OIDC_ISSUER_URL;
      const issuerUrl = (!rawIssuer || rawIssuer === 'https://admin.selfera.co.uk' || rawIssuer.includes('automaitee-admin.vercel.app')) ? 'https://selfera-admin-api.vercel.app' : rawIssuer;
      const clientId = process.env.OIDC_CLIENT_ID
      const clientSecret = process.env.OIDC_CLIENT_SECRET

      if (!clientId || !clientSecret) {
        console.error('[SSO] Missing OIDC_CLIENT_ID or OIDC_CLIENT_SECRET in environment variables.')
        return NextResponse.redirect(new URL('/login?error=ConfigurationError', request.url))
      }

      const proto = request.headers.get("x-forwarded-proto") || (request.url.startsWith("https") ? "https" : "http");
      const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
      const redirectUri = host ? `${proto}://${host}${request.nextUrl.pathname}` : new URL(request.nextUrl.pathname, request.url).toString();

      const tokenRes = await fetch(`${issuerUrl}/api/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        }),
      })

      if (!tokenRes.ok) {
        const errorText = await tokenRes.text()
        console.error('[SSO] OIDC token exchange failed:', errorText)
        return NextResponse.redirect(new URL('/login?error=InvalidAuthorizationCode', request.url))
      }

      const tokenData = await tokenRes.json()
      const idToken = tokenData.id_token
      oidcRefreshToken = tokenData.refresh_token || null
      payload = verifyToken(idToken)
    } else if (token) {
      // 2. Direct JWT Flow (Legacy fallback)
      payload = verifyToken(token)
    }

    if (!payload || !payload.email) {
      return NextResponse.redirect(new URL('/login?error=InvalidSSOToken', request.url))
    }

    const email = String(payload.email).trim().toLowerCase()
    const service = createServiceClient()

    // 3. Generate magiclink OTP hash for this verified email
    const { data: linkData, error: linkErr } = await service.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error('[SSO] generateLink failed:', linkErr)
      return NextResponse.redirect(new URL('/login?error=AccountNotFound', request.url))
    }

    const tokenHash = linkData.properties.hashed_token

    // 4. Establish session via @supabase/ssr createClient
    const supabase = await createClient()
    const { data: authData, error: verifyErr } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    })

    if (verifyErr || !authData?.user) {
      console.error('[SSO] verifyOtp failed:', verifyErr)
      return NextResponse.redirect(new URL('/login?error=InvalidSSOToken', request.url))
    }

    // 5. Validate user access and sync profile/permissions
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1'
    const userAgent = request.headers.get('user-agent') || ''

    const validation = await validateAndSyncUserAccess({
      userId: authData.user.id,
      email: authData.user.email || email,
      ipAddress,
      userAgent,
    })

    if (!validation.ok) {
      await supabase.auth.signOut()
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(validation.error || 'Access denied.')}`, request.url)
      )
    }

    // 6. Set 30-day refresh token in shared.refresh_tokens and response cookies
    let activeRefreshToken = oidcRefreshToken
    if (!activeRefreshToken) {
      activeRefreshToken = crypto.randomBytes(40).toString('hex')
      const hash = crypto.createHash('sha256').update(activeRefreshToken).digest('hex')
      try {
        await service.schema('shared').from('refresh_tokens').insert({
          employee_id: validation.employee?.id || null,
          token_hash: hash,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          session_id: crypto.randomUUID(),
          session_started_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        })
      } catch (insertErr) {
        console.warn('[SSO] Non-fatal refresh token DB save warning:', insertErr)
      }
    }

    const targetUrl = redirectPath.startsWith('/') ? redirectPath : '/dashboard'
    const response = NextResponse.redirect(new URL(targetUrl, request.url))
    const isProd = process.env.NODE_ENV === 'production'

    if (activeRefreshToken) {
      response.cookies.set('refreshToken', activeRefreshToken, {
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        sameSite: 'lax',
        httpOnly: true,
        secure: isProd,
      })
      response.cookies.set('selfera_refresh_token', activeRefreshToken, {
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        sameSite: 'lax',
        httpOnly: true,
        secure: isProd,
      })
    }

    return response
  } catch (err: any) {
    console.error('[SSO] Unexpected error:', err)
    return NextResponse.redirect(new URL('/login?error=SSOFailed', request.url))
  }
}
