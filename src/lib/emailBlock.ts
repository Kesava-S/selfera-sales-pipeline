// Leads on the do-not-contact list for email (opted out, bounced, or reported spam).
// Used by the chat screen and checked again by the send route and "Mark as sent".

import type { SupabaseClient } from '@supabase/supabase-js'
import { exactLike } from '@/lib/unsubscribe'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>

export type EmailBlock = { id: string; source: string | null; created_at: string }

export const BLOCK_LABEL: Record<string, string> = {
  unsubscribe: 'Opted out',
  bounce: 'Email bounced',
  complaint: 'Marked our email as spam',
}

export async function findEmailBlock(supabase: Client, email: string | null | undefined): Promise<EmailBlock | null> {
  if (!email?.trim()) return null
  const { data } = await supabase
    .from('opt_outs').select('id, source, created_at').ilike('identifier', exactLike(email))
    .in('channel', ['All', 'Email', 'all', 'email']).order('created_at', { ascending: false }).limit(1).maybeSingle()
  return (data as EmailBlock | null) ?? null
}

// A lead who opted out and then wrote to us can get one answer per message they send.
// Bounced addresses and spam reports stay closed.
export function replyAllowed(block: EmailBlock, lastInboundAt: string | null | undefined, lastOutboundAt: string | null | undefined): boolean {
  if ((block.source !== 'unsubscribe' && block.source !== 'inbound') || !lastInboundAt) return false
  const inbound = new Date(lastInboundAt).getTime()
  return inbound > new Date(block.created_at).getTime() && (!lastOutboundAt || new Date(lastOutboundAt).getTime() < inbound)
}

// Why an email can't be sent, or null when it can
export async function emailSendBlocked(supabase: Client, threadId: string, email: string | null | undefined, lastInboundAt: string | null | undefined): Promise<string | null> {
  const block = await findEmailBlock(supabase, email)
  if (!block) return null
  const { data: last } = await supabase
    .from('messages').select('created_at').eq('thread_id', threadId).eq('direction', 'outbound')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (replyAllowed(block, lastInboundAt, last?.created_at)) return null
  const why = block.source === 'bounce' ? 'their address bounced' : block.source === 'complaint' ? 'they marked our email as spam' : 'they opted out'
  return `Not sent: this lead is on the do-not-contact list (${why} on ${new Date(block.created_at).toLocaleDateString('en-GB')}).`
}

// ---------- WhatsApp: numbers that replied STOP (migration 70) ----------
export async function findWhatsAppBlock(supabase: Client, phone: string | null | undefined): Promise<EmailBlock | null> {
  const digits = (phone || '').replace(/\D/g, '')
  if (digits.length < 7) return null
  // Stored as +<digits>; match on the last 9 digits, then compare exactly
  const { data } = await supabase
    .from('opt_outs').select('id, source, created_at, identifier').ilike('identifier', `%${digits.slice(-9)}`)
    .in('channel', ['All', 'WhatsApp', 'all', 'whatsapp']).order('created_at', { ascending: false }).limit(20)
  const hit = (data || []).find(o => o.identifier.replace(/\D/g, '') === digits)
  return hit ? { id: hit.id, source: hit.source, created_at: hit.created_at } : null
}

// Why a WhatsApp message can't be sent, or null when it can
export async function whatsappSendBlocked(supabase: Client, threadId: string, phone: string | null | undefined, lastInboundAt: string | null | undefined): Promise<string | null> {
  const block = await findWhatsAppBlock(supabase, phone)
  if (!block) return null
  const { data: last } = await supabase
    .from('messages').select('created_at').eq('thread_id', threadId).eq('direction', 'outbound')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (replyAllowed(block, lastInboundAt, last?.created_at)) return null
  return `Not sent: this number replied STOP on ${new Date(block.created_at).toLocaleDateString('en-GB')} and is on the do-not-contact list.`
}
