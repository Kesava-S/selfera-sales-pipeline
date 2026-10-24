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
