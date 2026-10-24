// Campaign send queue worker. Launching a campaign only queues its recipients
// (enqueue_campaign); this takes small batches from the queue, sends them and
// records each result. Failed sends are retried by the database (1 min, 5 min)
// before being marked failed. Called from /api/campaigns/process by the open
// campaign screen and by a once-a-minute cron.

import { createServiceClient } from '@/lib/supabase/server'

export type CampaignChannel = 'email' | 'whatsapp'

export type CampaignProgress = {
  status: string | null
  total: number
  queued: number
  sending: number
  sent: number
  failed: number
  skipped: number
  simulated: number
  retrying: number
  // WhatsApp only: what Meta reported after sending
  delivered: number
  read: number
  // Email only: from Resend's tracking
  opened: number
  clicked: number
  bounced: number
  failures: { to: string; name: string | null; error: string | null }[]
}

type ClaimedSend = {
  id: string
  channel: CampaignChannel
  campaign_id: string
  email: string | null
  phone: string | null
  business_name: string | null
  contact_name: string | null
  attempts: number
}

type SendResult = { id: string; ok: boolean; error?: string; external_id?: string | null; simulated?: boolean; permanent?: boolean }

type CampaignContent = { subject?: string; body?: string; message?: string; service?: string | null; template_name?: string | null }

function personalise(text: string, r: ClaimedSend, service?: string | null) {
  return text
    .replace(/\{business_name\}/g, r.business_name || 'your business')
    .replace(/\{contact_name\}/g, r.contact_name || 'there')
    .replace(/\{service\}/g, service || 'our services')
}

// Outside production a missing SMTP/WhatsApp setup records the send as simulated,
// so campaigns can be tried locally. In production it is a real failure.
const canSimulate = () => process.env.NEXT_PUBLIC_APP_ENV !== 'production' && process.env.VERCEL_ENV !== 'production'

async function sendOne(r: ClaimedSend, c: CampaignContent | undefined): Promise<SendResult> {
  if (!c) return { id: r.id, ok: false, error: 'Campaign no longer exists.', permanent: true }

  if (r.channel === 'email') {
    const { isSmtpConfigured, sendEmail } = await import('@/lib/mailer')
    if (!isSmtpConfigured()) {
      return canSimulate()
        ? { id: r.id, ok: true, simulated: true }
        : { id: r.id, ok: false, error: 'Email sending is not configured (add RESEND_API_KEY or SMTP_PASS).', permanent: true }
    }
    try {
      const { messageId } = await sendEmail({
        to: r.email!,
        subject: personalise(c.subject || '', r, c.service),
        body: personalise(c.body || '', r, c.service),
      })
      return { id: r.id, ok: true, external_id: messageId }
    } catch (err) {
      // SMTP 5xx or a Resend 4xx (unknown mailbox, rejected address) will never succeed, so don't retry it
      const code = (err as { responseCode?: number })?.responseCode
      return {
        id: r.id,
        ok: false,
        error: err instanceof Error ? err.message : 'Email send failed.',
        permanent: Boolean((err as { permanent?: boolean })?.permanent) || (typeof code === 'number' && code >= 500 && code < 600),
      }
    }
  }

  const { isWhatsAppConfigured, sendWhatsAppMessage } = await import('@/lib/whatsapp')
  if (!isWhatsAppConfigured()) {
    return canSimulate()
      ? { id: r.id, ok: true, simulated: true }
      : { id: r.id, ok: false, error: 'WhatsApp is not configured.', permanent: true }
  }
  try {
    const res = await sendWhatsAppMessage({
      to: r.phone!,
      body: personalise(c.message || '', r, c.service),
      templateName: c.template_name || null,
    })
    return res.success
      ? { id: r.id, ok: true, external_id: res.messageId }
      : { id: r.id, ok: false, error: res.error || 'WhatsApp send failed.' }
  } catch (err) {
    // Thrown only for an unusable number, which a retry won't fix
    return { id: r.id, ok: false, error: err instanceof Error ? err.message : 'WhatsApp send failed.', permanent: true }
  }
}

// Send queued messages until the queue is empty or the time budget runs out.
// `campaignId` sends that campaign's recipients first (the open campaign screen).
export async function processCampaignQueue({
  campaignId = null,
  timeBudgetMs = 20_000,
  batchSize = 10,
}: { campaignId?: string | null; timeBudgetMs?: number; batchSize?: number } = {}) {
  const db = createServiceClient()
  const started = Date.now()
  const campaigns = new Map<string, CampaignContent>()
  let sent = 0
  let failed = 0

  while (Date.now() - started < timeBudgetMs) {
    const { data, error } = await db.rpc('claim_campaign_sends', { p_limit: batchSize, p_campaign_id: campaignId })
    if (error) throw new Error(`Could not read the send queue: ${error.message}`)
    const batch = (data || []) as ClaimedSend[]
    if (!batch.length) break

    // Load each campaign's content once
    for (const channel of ['email', 'whatsapp'] as const) {
      const ids = [...new Set(batch.filter(b => b.channel === channel && !campaigns.has(b.campaign_id)).map(b => b.campaign_id))]
      if (!ids.length) continue
      const { data: rows } = await db
        .from(channel === 'email' ? 'email_campaigns' : 'whatsapp_campaigns')
        .select(channel === 'email' ? 'id, subject, body, service' : 'id, message, service, template_name')
        .in('id', ids)
      for (const row of (rows || []) as unknown as (CampaignContent & { id: string })[]) campaigns.set(row.id, row)
    }

    const results: SendResult[] = []
    for (const r of batch) {
      const res = await sendOne(r, campaigns.get(r.campaign_id))
      if (res.ok) sent++
      else failed++
      results.push(res)
    }

    const { error: doneError } = await db.rpc('complete_campaign_sends', { p_results: results })
    if (doneError) throw new Error(`Could not record send results: ${doneError.message}`)
  }

  return { sent, failed }
}

export async function getCampaignProgress(channel: CampaignChannel, campaignId: string) {
  const { data, error } = await createServiceClient().rpc('campaign_progress', { p_channel: channel, p_campaign_id: campaignId })
  if (error) throw new Error(error.message)
  return data as CampaignProgress
}
