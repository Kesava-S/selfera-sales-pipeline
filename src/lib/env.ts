/**
 * Environment configuration and validation helper.
 * Ensures required Supabase environment variables are present and valid.
 */

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return false
  }

  // Check if they are still the default placeholders
  if (url.includes('your-project-ref') || anonKey === 'your-anon-key-here') {
    return false
  }

  return true
}

export function getSupabaseSchema(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || 'sales-pipe'
}

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const schema = getSupabaseSchema()

  return {
    supabaseUrl: url || '',
    supabaseAnonKey: anonKey || '',
    supabaseSchema: schema,
    isConfigured: isSupabaseConfigured(),
  }
}

