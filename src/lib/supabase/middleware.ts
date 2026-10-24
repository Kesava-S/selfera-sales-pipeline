import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const isPublicRoute =
    pathname.startsWith('/api/whatsapp/webhook') ||
    pathname.startsWith('/api/email/sync') ||
    // Resend delivery events: the route checks Resend's signature itself
    pathname.startsWith('/api/email/webhook') ||
    // Campaign queue worker: checks the cron secret or a staff session itself
    pathname.startsWith('/api/campaigns/process') ||
    // Leads unsubscribing from the link in our emails: the link is signed
    pathname.startsWith('/unsubscribe') ||
    pathname.startsWith('/api/unsubscribe') ||
    pathname.startsWith('/_next') ||
    pathname === '/logo.png' ||
    pathname === '/favicon.ico'

  if (isPublicRoute) {
    return supabaseResponse
  }

  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/auth')
  const isSsoRoute = pathname.startsWith('/sso') || pathname.startsWith('/api/auth')

  // Silent refresh if Supabase session is expired but refresh token exists
  if (!user && !isAuthRoute && !isSsoRoute) {
    const refreshToken =
      request.cookies.get('refreshToken')?.value ||
      request.cookies.get('selfera_refresh_token')?.value

    if (refreshToken) {
      const issuerUrl = process.env.OIDC_ISSUER_URL || 'http://localhost:3001'
      const clientId = process.env.OIDC_CLIENT_ID
      const clientSecret = process.env.OIDC_CLIENT_SECRET

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
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
            if (payload && payload.email) {
              const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
              if (serviceKey) {
                const serviceClient = createAdminClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL!,
                  serviceKey,
                  { auth: { persistSession: false, autoRefreshToken: false } }
                )

                const { data: linkData } = await serviceClient.auth.admin.generateLink({
                  type: 'magiclink',
                  email: payload.email,
                })

                if (linkData?.properties?.hashed_token) {
                  const { data: authResult } = await supabase.auth.verifyOtp({
                    token_hash: linkData.properties.hashed_token,
                    type: 'magiclink',
                  })

                  if (authResult?.user) {
                    user = authResult.user
                    const isProd = process.env.NODE_ENV === 'production'

                    supabaseResponse.cookies.set('refreshToken', newRefreshToken, {
                      path: '/',
                      maxAge: 30 * 24 * 60 * 60,
                      sameSite: 'lax',
                      httpOnly: true,
                      secure: isProd,
                    })
                    supabaseResponse.cookies.set('selfera_refresh_token', newRefreshToken, {
                      path: '/',
                      maxAge: 30 * 24 * 60 * 60,
                      sameSite: 'lax',
                      httpOnly: true,
                      secure: isProd,
                    })
                  }
                }
              }
            }
          }
        }
      } catch (refreshErr) {
        console.warn('[Proxy] Silent refresh attempt failed:', refreshErr)
      }
    }
  }
}

  if (!user && !isAuthRoute && !isSsoRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    if (pathname !== '/' && pathname !== '/dashboard') {
      url.searchParams.set('next', pathname)
    }
    return NextResponse.redirect(url)
  }

  if (user && (isAuthRoute || pathname === '/') && !isSsoRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
