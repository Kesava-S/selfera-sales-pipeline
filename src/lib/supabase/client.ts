import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseSchema } from '@/lib/env'

export function createClient() {
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

