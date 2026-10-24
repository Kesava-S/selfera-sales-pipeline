// Unsubscribe links: /unsubscribe?e=<address>&s=<signature>. The signature
// stops anyone unsubscribing an address they don't own by editing the link.

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

function sign(email: string): string {
  return crypto.createHmac('sha256', secret()).update(`unsubscribe:${normalise(email)}`).digest('base64url').slice(0, 32)
}

// Null when no secret is set: the template then falls back to its mailto link
export function unsubscribeUrl(email: string): string | null {
  if (!secret() || !email.includes('@')) return null
  const e = Buffer.from(normalise(email)).toString('base64url')
  return `${appBaseUrl()}/unsubscribe?e=${e}&s=${sign(email)}`
}

// The address a link was made for, or null if it was altered
export function verifyUnsubscribe(e: string | null | undefined, s: string | null | undefined): string | null {
  if (!e || !s || !secret()) return null
  let email: string
  try { email = Buffer.from(e, 'base64url').toString('utf8') } catch { return null }
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) return null
  const expected = sign(email)
  return s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)) ? normalise(email) : null
}
