import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseSchema } from '@/lib/env'
import { isDemoMode, createDemoClient } from '@/lib/demo/demoClient'

async function createRealClient() {
  const cookieStore = await cookies()
  const schema = getSupabaseSchema()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: {
        schema,
      },
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
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  )
}

export async function createClient(): ReturnType<typeof createRealClient> {
  // DEMO MODE (local testing only): use in-memory café data instead of Supabase
  if (isDemoMode()) return createDemoClient()
  return createRealClient()
}
