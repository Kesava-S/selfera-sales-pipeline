import { NextResponse, after } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { isDualWriteEnabled, replicateRpcToSecondary } from '@/lib/dual-write'
import { captureCampaignReply } from '@/lib/campaignReplies'
import { getWhatsAppConfig } from '@/lib/integrations'

export const dynamic = 'force-dynamic'

/**
 * Meta WhatsApp Cloud API Webhook Handler
 * 
 * GET: Webhook verification challenge from Meta App Dashboard
 * POST: Real-time inbound messages & delivery status updates
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = (await getWhatsAppConfig().catch(() => null))?.verify_token

  if (mode === 'subscribe' && token && token === verifyToken) {
    console.log('[WhatsApp Webhook] Verification successful!')
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  console.warn('[WhatsApp Webhook] Verification failed. Token mismatch.')
  return new Response('Forbidden', { status: 403 })
}

// Meta signs every webhook with the app secret (X-Hub-Signature-256).
// The app secret comes from Integrations. If it isn't set or the signature is wrong, reject the request.
async function signatureOk(raw: string, header: string | null): Promise<boolean> {
  const secret = (await getWhatsAppConfig().catch(() => null))?.app_secret
  if (!secret) {
    console.error('[WhatsApp Webhook] The WhatsApp app secret is not set in Integrations. Webhook rejected for security.')
    return false
  }
  if (!header?.startsWith('sha256=')) {
    console.warn('[WhatsApp Webhook] Missing or malformed x-hub-signature-256 header.')
    return false
  }
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex')
  const given = header.slice(7)
  const ok = given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  if (!ok) {
    console.warn('[WhatsApp Webhook] Signature verification failed (x-hub-signature-256 does not match configured app_secret).')
  }
  return ok
}

type MetaStatus = {
  id: string
  status: string
  timestamp?: string
  errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[]
}

// Meta sends updates to one address only (production). Production passes each signed
// update on to the sites in WHATSAPP_WEBHOOK_FORWARD_URLS (comma separated, e.g. dev),
// so their own messages get replies and delivery updates too. Forwarded updates keep
// Meta's signature, so the receiving site checks them the same way, and are never
// forwarded again.
const FORWARDED_HEADER = 'x-selfera-forwarded'

function forwardToOtherSites(raw: string, signature: string | null, request: Request) {
  if (request.headers.get(FORWARDED_HEADER) || !signature) return
  const self = new URL(request.url).host
  const targets = (process.env.WHATSAPP_WEBHOOK_FORWARD_URLS || '')
    .split(',').map(u => u.trim()).filter(Boolean)
    .filter(u => { try { return new URL(u).host !== self } catch { return false } })
  if (!targets.length) return
  after(async () => {
    await Promise.all(targets.map(url =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': signature, [FORWARDED_HEADER]: '1' },
        body: raw,
        signal: AbortSignal.timeout(8_000),
      })
        .then(res => { if (!res.ok) console.warn(`[WhatsApp Webhook] Forward to ${url} returned ${res.status}`) })
        .catch(err => console.warn(`[WhatsApp Webhook] Forward to ${url} failed:`, err?.message || err))
    ))
  })
}

export async function POST(request: Request) {
  try {
    const raw = await request.text()
    const signature = request.headers.get('x-hub-signature-256')
    if (!(await signatureOk(raw, signature))) {
      console.warn('[WhatsApp Webhook] Rejected a request with a missing or wrong signature.')
      return NextResponse.json({ status: 'forbidden' }, { status: 401 })
    }
    forwardToOtherSites(raw, signature, request)
    const payload = (() => { try { return JSON.parse(raw) } catch { return {} } })()

    if (payload.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ignored' }, { status: 200 })
    }

    const entries = payload.entry || []
    const supabase = createServiceClient()

    for (const entry of entries) {
      const changes = entry.changes || []
      for (const change of changes) {
        // Meta reviewed a template, or its quality changed (WhatsApp Templates page)
        if (change.field === 'message_template_status_update' || change.field === 'message_template_quality_update') {
          const v = change.value || {}
          const metaId = v.message_template_id != null ? String(v.message_template_id) : null
          if (metaId) {
            const patch = change.field === 'message_template_status_update'
              ? { status: String(v.event || 'PENDING').toUpperCase(), rejected_reason: v.reason && v.reason !== 'NONE' ? String(v.reason) : null }
              : { quality_score: v.new_quality_score ? String(v.new_quality_score) : null }
            const { error: tplError } = await supabase.from('meta_templates').update({ ...patch, last_synced_at: new Date().toISOString() }).eq('meta_id', metaId)
            if (tplError) console.error('[WhatsApp Webhook] template update error:', tplError.message)
          }
          continue
        }
        if (change.field !== 'messages') continue

        const value = change.value || {}
        const messages = value.messages || []

        // Delivery receipts for messages we sent: sent -> delivered -> read, or failed
        const statuses = (value.statuses || []) as MetaStatus[]
        if (statuses.length) {
          console.log(`[WhatsApp Webhook] 📋 Received ${statuses.length} status update(s):`, statuses.map(s => `${s.id}: ${s.status}`).join(', '))
          const statusArgs = {
            p_statuses: statuses.map(st => ({
              id: st.id,
              status: st.status,
              timestamp: st.timestamp ?? null,
              error: st.errors?.[0]
                ? `${st.errors[0].code ? `(#${st.errors[0].code}) ` : ''}${st.errors[0].error_data?.details || st.errors[0].message || st.errors[0].title || ''}`.trim() || null
                : null,
            })),
          }
          const { data: updatedCount, error: statusError } = await supabase.rpc('record_whatsapp_status', statusArgs)
          if (statusError) {
            console.error('[WhatsApp Webhook] record_whatsapp_status error:', statusError.message)
          } else {
            console.log(`[WhatsApp Webhook] ✅ Updated ${updatedCount ?? 0} message delivery record(s) in database.`)
          }
          if (!statusError && isDualWriteEnabled()) {
            replicateRpcToSecondary('record_whatsapp_status', statusArgs).catch(err => {
              console.warn('[DualWrite] Failed to replicate record_whatsapp_status:', err)
            })
          }
        }

        for (const msg of messages) {
          const from = msg.from // e.g. "447928750453"
          const messageId = msg.id

          let body = ''
          if (msg.type === 'text') {
            body = msg.text?.body || ''
          } else if (msg.type === 'button') {
            body = msg.button?.text || ''
          } else if (msg.type === 'interactive') {
            body = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || ''
          } else {
            body = `[WhatsApp ${msg.type} message received]`
          }

          body = body.trim()
          if (!body || !from) continue

          console.log(`[WhatsApp Webhook] 📩 Inbound message from ${from}: "${body}" (${messageId})`)

          const inboundArgs = {
            p_platform: 'WhatsApp',
            p_external_thread_id: null,
            p_from: from,
            p_body: body,
            p_external_message_id: messageId,
            p_media_url: null,
          }

          const { error: rpcError } = await supabase.rpc('record_inbound', inboundArgs)
          // Replies to campaigns (and unknown senders) are kept on the campaign side too
          await captureCampaignReply(supabase, { channel: 'whatsapp', from, body, externalMessageId: messageId })
          // A STOP reply puts the number on the do-not-contact list (no-op for other messages)
          const optOutArgs = { p_from: from, p_body: body }
          const { error: optOutError } = await supabase.rpc('record_whatsapp_opt_out', optOutArgs)
          if (optOutError) {
            console.error('[WhatsApp Webhook] record_whatsapp_opt_out error:', optOutError.message)
          } else if (isDualWriteEnabled()) {
            replicateRpcToSecondary('record_whatsapp_opt_out', optOutArgs).catch(err => {
              console.warn('[DualWrite] Failed to replicate record_whatsapp_opt_out:', err)
            })
          }

          if (rpcError) {
            console.error('[WhatsApp Webhook] record_inbound error:', rpcError.message)
          } else {
            console.log(`[WhatsApp Webhook] Recorded inbound WhatsApp reply from ${from}`)
            if (isDualWriteEnabled()) {
              replicateRpcToSecondary('record_inbound', inboundArgs).catch(err => {
                console.warn('[DualWrite] Failed to replicate whatsapp record_inbound:', err)
              })
            }
          }
        }
      }
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 })
  } catch (err: any) {
    console.error('[WhatsApp Webhook] Error processing webhook event:', err)
    // Always return 200 to Meta so it doesn't drop the webhook
    return NextResponse.json({ status: 'error', message: err?.message }, { status: 200 })
  }
}
