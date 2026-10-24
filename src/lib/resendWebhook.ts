// Resend webhooks: signature check (Svix format) and mapping Resend's events
// to what record_email_events() stores.

import crypto from 'crypto'

const TOLERANCE_SECONDS = 5 * 60

// Resend signs `${svix-id}.${svix-timestamp}.${body}` with the endpoint's
// "whsec_..." secret; svix-signature holds one or more "v1,<base64>" values.
export function verifyResendSignature(
  raw: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string,
  now = Math.floor(Date.now() / 1000)
): boolean {
  if (!headers.id || !headers.timestamp || !headers.signature) return false
  const ts = Number(headers.timestamp)
  if (!Number.isFinite(ts) || Math.abs(now - ts) > TOLERANCE_SECONDS) return false

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = crypto.createHmac('sha256', key).update(`${headers.id}.${headers.timestamp}.${raw}`).digest('base64')
  return headers.signature.split(' ').some(part => {
    const [version, sig] = part.split(',')
    return version === 'v1' && !!sig && sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  })
}

type ResendEvent = {
  type?: string
  created_at?: string
  data?: {
    email_id?: string
    created_at?: string
    to?: string[] | string
    bounce?: { message?: string; type?: string; subType?: string }
    failed?: { reason?: string }
  }
}

// email.delivered -> { id, type: 'delivered', ... } for record_email_events()
export function toEmailEvent(e: ResendEvent) {
  const type = e.type?.replace(/^email\./, '')
  const id = e.data?.email_id
  if (!type || !id) return null
  const to = Array.isArray(e.data?.to) ? e.data?.to[0] : e.data?.to
  return {
    id,
    type,
    at: e.created_at || e.data?.created_at || null,
    to: to || null,
    reason: e.data?.bounce?.message || e.data?.failed?.reason || null,
    // Only a permanent ("hard") bounce means the address is dead
    permanent: type === 'bounced' ? (e.data?.bounce?.type || 'Permanent').toLowerCase() === 'permanent' : null,
  }
}
