// Replies to email and WhatsApp campaigns. Called right after record_inbound,
// so a reply that also belongs in a Lead Management chat is linked to it.

import type { SupabaseClient } from '@supabase/supabase-js'
import { isDualWriteEnabled, replicateRpcToSecondary } from '@/lib/dual-write'

export type CampaignReplyArgs = {
  channel: 'email' | 'whatsapp'
  from: string
  body: string
  subject?: string | null
  externalMessageId: string | null
  // Emails from unknown senders are only kept when they look like a reply (not newsletters)
  looksLikeReply?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function captureCampaignReply(supabase: SupabaseClient<any, any, any>, a: CampaignReplyArgs): Promise<string | null> {
  const args = {
    p_channel: a.channel,
    p_from: a.from,
    p_body: a.body,
    p_subject: a.subject ?? null,
    p_external_message_id: a.externalMessageId,
    p_looks_like_reply: a.looksLikeReply ?? true,
  }
  const { data, error } = await supabase.rpc('capture_campaign_reply', args)
  if (error) {
    console.error('[CampaignReplies] capture_campaign_reply error:', error.message)
    return null
  }
  if (isDualWriteEnabled()) {
    replicateRpcToSecondary('capture_campaign_reply', args).catch(err => console.warn('[DualWrite] capture_campaign_reply:', err))
  }
  return data as string
}

// ---------- Reading them back (screens) ----------

export type CampaignReply = {
  id: string
  channel: 'email' | 'whatsapp'
  from_address: string
  subject: string | null
  body: string
  received_at: string
  status: 'new' | 'in_leads' | 'dismissed'
  campaign_id: string | null
  whatsapp_campaign_id: string | null
  business_id: string | null
  opportunity_id: string | null
  thread_id: string | null
  businesses: { business_name: string } | null
  email_campaigns: { name: string } | null
  whatsapp_campaigns: { name: string } | null
}

export const REPLY_SELECT = 'id, channel, from_address, subject, body, received_at, status, campaign_id, whatsapp_campaign_id, business_id, opportunity_id, thread_id, businesses (business_name), email_campaigns (name), whatsapp_campaigns (name)'
