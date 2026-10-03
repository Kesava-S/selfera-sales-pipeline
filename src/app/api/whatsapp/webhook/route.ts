import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

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

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}))

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

          // Store reply into database
          const { error: rpcError } = await supabase.rpc('record_inbound', {
            p_platform: 'WhatsApp',
            p_external_thread_id: null,
            p_from: from,
            p_body: body,
            p_external_message_id: messageId,
            p_media_url: null,
          })

          if (rpcError) {
            console.error('[WhatsApp Webhook] record_inbound error:', rpcError.message)
          } else {
            console.log(`[WhatsApp Webhook] ✅ Recorded inbound WhatsApp reply from ${from}`)
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
