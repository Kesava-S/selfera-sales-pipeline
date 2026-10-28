import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { isDualWriteEnabled, replicateRpcToSecondary } from '@/lib/dual-write'
import { captureCampaignReply } from '@/lib/campaignReplies'

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

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN

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

// Meta signs every webhook with the app secret (X-Hub-Signature-256). Without
// WHATSAPP_APP_SECRET set we can't check it, so requests are accepted as before.
function signatureOk(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret) return true
  if (!header?.startsWith('sha256=')) return false
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex')
  const given = header.slice(7)
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))
}

type MetaStatus = {
  id: string
  status: string
  timestamp?: string
  errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[]
}

export async function POST(request: Request) {
  try {
    const raw = await request.text()
    if (!signatureOk(raw, request.headers.get('x-hub-signature-256'))) {
      console.warn('[WhatsApp Webhook] Rejected a request with a missing or wrong signature.')
      return NextResponse.json({ status: 'forbidden' }, { status: 401 })
    }
    const payload = (() => { try { return JSON.parse(raw) } catch { return {} } })()

    if (payload.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ignored' }, { status: 200 })
    }

    const entries = payload.entry || []
    const supabase = createServiceClient()

    for (const entry of entries) {
      const changes = entry.changes || []
      for (const change of changes) {
        if (change.field !== 'messages') continue

        const value = change.value || {}
        const messages = value.messages || []

        // Delivery receipts for messages we sent: sent -> delivered -> read, or failed
        const statuses = (value.statuses || []) as MetaStatus[]
        if (statuses.length) {
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
          const { error: statusError } = await supabase.rpc('record_whatsapp_status', statusArgs)
          if (statusError) {
            console.error('[WhatsApp Webhook] record_whatsapp_status error:', statusError.message)
          } else if (isDualWriteEnabled()) {
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
