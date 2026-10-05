import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

let cachedDualClient: SupabaseClient<any, any, any> | null = null

export function isDualWriteEnabled(): boolean {
  const isProduction =
    process.env.NEXT_PUBLIC_APP_ENV === 'production' ||
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'

  return (
    isProduction &&
    process.env.DUAL_WRITE_ENABLED === 'true' &&
    Boolean(process.env.DUAL_WRITE_SUPABASE_URL) &&
    Boolean(process.env.DUAL_WRITE_SUPABASE_SERVICE_ROLE_KEY)
  )
}

export function getDualWriteClient(): SupabaseClient<any, any, any> | null {
  if (!isDualWriteEnabled()) return null
  if (cachedDualClient) return cachedDualClient

  const url = process.env.DUAL_WRITE_SUPABASE_URL!
  const key = process.env.DUAL_WRITE_SUPABASE_SERVICE_ROLE_KEY!
  const schema = process.env.DUAL_WRITE_SUPABASE_SCHEMA || process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || 'sales-pipe'

  cachedDualClient = createSupabaseClient(url, key, {
    db: { schema },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return cachedDualClient
}

/**
 * Replicate an RPC mutation call to the secondary database (staging <-> production).
 * Non-blocking: failures in secondary replication are logged but do not interrupt the primary action.
 */
export async function replicateRpcToSecondary(fn: string, args: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  const client = getDualWriteClient()
  if (!client) {
    return { success: false, error: 'Dual-write not configured or disabled' }
  }

  try {
    const { error } = await client.rpc(fn, args)
    if (error) {
      console.warn(`[DualWrite] Failed to replicate RPC "${fn}":`, error.message)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err: any) {
    console.warn(`[DualWrite] Unexpected error during RPC "${fn}" replication:`, err?.message || err)
    return { success: false, error: err?.message || 'Replication error' }
  }
}

/**
 * Replicate a table-level mutation (insert/update/delete) to the secondary database.
 */
export async function replicateTableMutationToSecondary(opts: {
  table: string
  operation: 'insert' | 'update' | 'delete'
  data?: any
  matchKey?: string
  matchValue?: any
  schema?: string
}): Promise<{ success: boolean; error?: string }> {
  const client = getDualWriteClient()
  if (!client) return { success: false }

  const { table, operation, data, matchKey, matchValue, schema } = opts
  const query = schema ? client.schema(schema).from(table) : client.from(table)

  try {
    let res: any
    if (operation === 'insert') {
      res = await query.insert(data)
    } else if (operation === 'update' && matchKey) {
      res = await query.update(data).eq(matchKey, matchValue)
    } else if (operation === 'delete' && matchKey) {
      res = await query.delete().eq(matchKey, matchValue)
    }

    if (res?.error) {
      console.warn(`[DualWrite] Failed to replicate ${operation} on table "${table}":`, res.error.message)
      return { success: false, error: res.error.message }
    }

    return { success: true }
  } catch (err: any) {
    console.warn(`[DualWrite] Unexpected error during ${operation} on table "${table}":`, err?.message || err)
    return { success: false, error: err?.message }
  }
}
