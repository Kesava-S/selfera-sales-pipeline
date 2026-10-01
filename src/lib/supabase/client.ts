import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseSchema } from '@/lib/env'
import { isDemoMode, createDemoClient } from '@/lib/demo/demoClient'

function createRealClient() {
  const schema = getSupabaseSchema()
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: {
        schema,
      },
    }
  )
}

export function createClient(): ReturnType<typeof createRealClient> {
  // DEMO MODE (local testing only): use in-memory café data instead of Supabase
  if (isDemoMode()) return createDemoClient()
  return createRealClient()
}
