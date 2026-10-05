import { createServerClient } from '@supabase/ssr'
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

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const isPublicRoute =
    pathname.startsWith('/api/whatsapp/webhook') ||
    pathname.startsWith('/api/email/sync') ||
    pathname.startsWith('/_next') ||
    pathname === '/logo.png' ||
    pathname === '/favicon.ico'

  if (isPublicRoute) {
    return supabaseResponse
  }

  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/auth')

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    if (pathname !== '/' && pathname !== '/dashboard') {
      url.searchParams.set('next', pathname)
    }
    return NextResponse.redirect(url)
  }

  if (user && (isAuthRoute || pathname === '/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
