'use server'

// Replies to email and WhatsApp campaigns: list them, hand one over to
// Lead Management for one-to-one follow-up, or dismiss it.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/app/dashboard/actions'
import { REPLY_SELECT, type CampaignReply } from '@/lib/campaignReplies'

export async function listCampaignReplies(channel: 'email' | 'whatsapp', campaignId: string): Promise<ActionResult<CampaignReply[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('campaign_replies').select(REPLY_SELECT)
    .eq(channel === 'email' ? 'campaign_id' : 'whatsapp_campaign_id', campaignId)
    .order('received_at', { ascending: false }).limit(100)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data || []) as unknown as CampaignReply[] }
}

export async function countNewCampaignReplies(channel?: 'email' | 'whatsapp'): Promise<number> {
  const supabase = await createClient()
  let q = supabase.from('campaign_replies').select('id', { count: 'exact', head: true }).eq('status', 'new')
  if (channel) q = q.eq('channel', channel)
  const { count } = await q
  return count ?? 0
}

export async function openCampaignReply(id: string): Promise<ActionResult<{ opportunity_id: string; thread_id: string }>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('open_campaign_reply_in_leads', { p_reply_id: id })
  if (error) return { ok: false, error: error.message.replace(/^.*?ERROR:\s*/i, '') }
  revalidatePath('/dashboard', 'layout')
  return { ok: true, data: data as { opportunity_id: string; thread_id: string } }
}

export async function dismissCampaignReply(id: string, undo = false): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('dismiss_campaign_reply', { p_reply_id: id, p_undo: undo })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard/campaigns/replies')
  return { ok: true }
}
