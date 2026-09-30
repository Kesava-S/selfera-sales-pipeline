import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignored if called during response streaming
            }
          },
        },
      }
    )

    const { data: sessionData, error: authError } = await supabase.auth.exchangeCodeForSession(code)

    if (!authError && sessionData.user) {
      // Verify user's role access to sales_pipeline (product_id: 11)
      const { data: userProfile } = await supabase
        .from('users')
        .select('id, user_id, role_id, is_active')
        .eq('user_id', sessionData.user.id)
        .single()

      if (userProfile?.role_id) {
        const { data: access } = await supabase
          .from('role_product_access')
          .select('can_access')
          .eq('role_id', userProfile.role_id)
          .eq('product_id', 11)
          .single()

        if (access && access.can_access === false) {
          await supabase.auth.signOut()
          return NextResponse.redirect(`${origin}/login?error=access_denied`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
