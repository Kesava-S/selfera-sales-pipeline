export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return false
  }

  if (url.includes('your-project-ref') || anonKey === 'your-anon-key-here') {
    return false
  }

  return true
}

export function getAppEnv(): 'local' | 'development' | 'staging' | 'production' {
  const env = process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV
  if (env === 'production') return 'production'
  if (env === 'staging') return 'staging'
  if (env === 'development') return 'development'
  return 'local'
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
    appEnv: getAppEnv(),
    dualWriteEnabled: process.env.DUAL_WRITE_ENABLED === 'true',
  }
}
