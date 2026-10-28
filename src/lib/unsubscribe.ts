// Opt-out links: /opt-out?e=<address>&s=<signature>. The signature
// stops anyone opting out an address they don't own by editing the link.
// Links sent before the rename point at /unsubscribe, which redirects here.

import crypto from 'crypto'

// UNSUBSCRIBE_SECRET signs the links. Changing it breaks links in emails already sent.
const secret = () => process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Where the app is reachable from the lead's inbox
export function appBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
    || (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`)
    || 'http://localhost:3000'
  return url.replace(/\/+$/, '')
}

const normalise = (email: string) => email.trim().toLowerCase()

// For .ilike(): matches the address exactly, case-insensitively (_ and % in an address are literal)
export const exactLike = (value: string) => value.trim().replace(/[\\%_]/g, '\\$&')

// Client Audience emails add the customer (c), so the opt-out applies to that client only
function sign(email: string, customerId?: string | null): string {
  const what = `unsubscribe:${normalise(email)}${customerId ? `:${customerId}` : ''}`
  return crypto.createHmac('sha256', secret()).update(what).digest('base64url').slice(0, 32)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Null when no secret is set: the template then falls back to its mailto link
export function unsubscribeUrl(email: string, customerId?: string | null): string | null {
  if (!secret() || !email.includes('@')) return null
  const e = Buffer.from(normalise(email)).toString('base64url')
  return `${appBaseUrl()}/opt-out?e=${e}&s=${sign(email, customerId)}${customerId ? `&c=${customerId}` : ''}`
}

// The address a link was made for, or null if it was altered
export function verifyUnsubscribe(e: string | null | undefined, s: string | null | undefined, c?: string | null): string | null {
  if (!e || !s || !secret()) return null
  if (c && !UUID.test(c)) return null
  let email: string
  try { email = Buffer.from(e, 'base64url').toString('utf8') } catch { return null }
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) return null
  const expected = sign(email, c)
  return s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)) ? normalise(email) : null
}
