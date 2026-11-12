import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isDualWriteEnabled, replicateRpcToSecondary } from '@/lib/dual-write'
import { toEmailEvent, verifyResendSignature } from '@/lib/resendWebhook'
import { getDynamicEmailConfig } from '@/lib/integrations'

export const dynamic = 'force-dynamic'

// Resend reports each email's progress here: delivered, opened, clicked,
// bounced, marked as spam. Every request must carry Resend's signature: a forged
// "bounced" would put a lead's address on the do-not-contact list.
export async function POST(request: Request) {
  const secret = (await getDynamicEmailConfig().catch(() => null))?.resend_webhook_secret
  if (!secret) {
    return NextResponse.json({ error: 'Email webhook is not set up (add the Resend webhook secret in Integrations).' }, { status: 503 })
  }

  const raw = await request.text()
  const signed = verifyResendSignature(raw, {
    id: request.headers.get('svix-id'),
    timestamp: request.headers.get('svix-timestamp'),
    signature: request.headers.get('svix-signature'),
  }, secret)
  if (!signed) {
    console.warn('[Email Webhook] Rejected a request with a missing or wrong signature.')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: unknown
  try { payload = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // Resend sends one event per request; accept a list too
  const events = (Array.isArray(payload) ? payload : [payload]).map(toEmailEvent).filter(Boolean)
  if (!events.length) return NextResponse.json({ status: 'ignored' })

  const args = { p_events: events }
  const { error } = await createServiceClient().rpc('record_email_events', args)
  if (error) {
    console.error('[Email Webhook] record_email_events error:', error.message)
    // A 5xx makes Resend retry later
    return NextResponse.json({ error: 'Could not record the event' }, { status: 500 })
  }
  if (isDualWriteEnabled()) {
    replicateRpcToSecondary('record_email_events', args).catch(err => {
      console.warn('[DualWrite] Failed to replicate record_email_events:', err)
    })
  }
  return NextResponse.json({ status: 'ok' })
}
