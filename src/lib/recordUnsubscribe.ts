import { createServiceClient } from '@/lib/supabase/server'
import { isDualWriteEnabled, replicateRpcToSecondary } from '@/lib/dual-write'
import { exactLike } from '@/lib/unsubscribe'

// Put an address on the do-not-contact list (notifies the team, logs it).
// Only call this after verifyUnsubscribe() has accepted the link.
export async function recordUnsubscribe(email: string): Promise<{ ok: boolean; error?: string }> {
  const args = { p_email: email }
  const { error } = await createServiceClient().rpc('record_unsubscribe', args)
  if (error) {
    console.error('[Unsubscribe] record_unsubscribe error:', error.message)
    return { ok: false, error: error.message }
  }
  if (isDualWriteEnabled()) {
    replicateRpcToSecondary('record_unsubscribe', args).catch(err => {
      console.warn('[DualWrite] Failed to replicate record_unsubscribe:', err)
    })
  }
  return { ok: true }
}

export async function isEmailOptedOut(email: string): Promise<boolean> {
  const { data } = await createServiceClient()
    .from('opt_outs').select('id').ilike('identifier', exactLike(email)).in('channel', ['All', 'Email', 'all', 'email']).limit(1)
  return Boolean(data?.length)
}

// ---------- Client Audience emails: opting out of one client only ----------

export async function recordAudienceOptOut(customerId: string, email: string): Promise<{ ok: boolean; client?: string }> {
  const { data, error } = await createServiceClient().rpc('record_audience_opt_out', { p_customer_id: customerId, p_email: email })
  if (error) {
    console.error('[OptOut] record_audience_opt_out error:', error.message)
    return { ok: false }
  }
  return { ok: true, client: (data as { client?: string } | null)?.client }
}

// The client's name and whether this customer has already opted out (null for a stale link)
export async function audienceOptOutStatus(customerId: string, email: string): Promise<{ client: string; optedOut: boolean } | null> {
  const { data } = await createServiceClient().rpc('audience_opt_out_status', { p_customer_id: customerId, p_email: email })
  const d = data as { client?: string; opted_out?: boolean } | null
  return d?.client ? { client: d.client, optedOut: !!d.opted_out } : null
}
