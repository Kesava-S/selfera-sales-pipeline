// Email checks that use the network (server only):
//  1. Does the domain accept email at all? (free DNS lookup of its mail servers)
//  2. Does the inbox exist? QuickEmailVerification API (free daily credits).
// The free checks in emailCheck.ts run first, so credits are only spent on emails
// that could be real.

import { promises as dns } from 'node:dns'
import { basicEmailCheck, normaliseEmail, type EmailCheck } from '@/lib/emailCheck'

const QEV = 'https://api.quickemailverification.com/v1/verify'

export const isEmailApiConfigured = () => Boolean(process.env.QUICKEMAILVERIFICATION_API_KEY)

// Mail servers per domain, looked up once per run
async function acceptsMail(domain: string, cache: Map<string, boolean | null>): Promise<boolean | null> {
  if (cache.has(domain)) return cache.get(domain)!
  let ok: boolean | null
  try {
    const mx = await dns.resolveMx(domain)
    ok = mx.some(m => m.exchange && m.exchange !== '.')
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'ENOTFOUND' || code === 'ENODATA') {
      // No mail servers listed: mail falls back to the domain's own address, if it has one
      ok = await dns.resolve4(domain).then(a => a.length > 0, () => false)
    } else ok = null // DNS hiccup: let the API decide
  }
  cache.set(domain, ok)
  return ok
}

type QevResponse = {
  result?: 'valid' | 'invalid' | 'unknown'
  reason?: string
  disposable?: string
  accept_all?: string
  role?: string
  did_you_mean?: string
  success?: string
  message?: string
}

const REASONS: Record<string, string> = {
  accepted_email: 'Inbox exists',
  rejected_email: 'Inbox does not exist',
  invalid_domain: 'Domain does not exist',
  invalid_email: 'Not a valid email address',
  no_connect: 'Mail server did not answer',
  timeout: 'Mail server took too long',
  unavailable_smtp: 'Mail server unavailable',
  unexpected_error: 'Could not be checked',
  no_mx_record: 'Domain does not accept email',
  temporarily_blocked: 'Mail server blocked the check for now',
  exceeded_storage: 'Inbox is full',
}

export class EmailApiOutOfCredits extends Error {}

async function qev(email: string): Promise<{ check: EmailCheck; credits: number | null }> {
  const key = process.env.QUICKEMAILVERIFICATION_API_KEY
  if (!key) throw new EmailApiOutOfCredits('QuickEmailVerification is not set up.')
  const res = await fetch(`${QEV}?${new URLSearchParams({ email, apikey: key })}`, { signal: AbortSignal.timeout(20_000), cache: 'no-store' })
  const header = res.headers.get('x-qev-remaining-credits')
  const credits = header !== null && header !== '' ? Number(header) : null
  const json = (await res.json().catch(() => ({}))) as QevResponse
  if (res.status === 402 || /credit/i.test(json.message || '')) throw new EmailApiOutOfCredits('No free email checks left today.')
  if (!res.ok || json.success === 'false') throw new Error(json.message || `QuickEmailVerification returned HTTP ${res.status}`)

  const yes = (v?: string) => v === 'true'
  const reason = REASONS[json.reason || ''] ?? (json.reason ? json.reason.replace(/_/g, ' ') : null)
  const suggestion = json.did_you_mean || null
  const role = yes(json.role)
  let check: EmailCheck
  if (yes(json.disposable)) check = { status: 'disposable', reason: 'Throwaway email service', suggestion, role }
  else if (json.result === 'valid' && yes(json.accept_all)) check = { status: 'risky', reason: 'Domain accepts every address, so the inbox can’t be confirmed', suggestion, role }
  else if (json.result === 'valid') check = { status: 'valid', reason, suggestion, role }
  else if (json.result === 'invalid') check = { status: 'invalid', reason, suggestion, role }
  else check = { status: 'unknown', reason, suggestion, role }
  return { check, credits }
}

export type VerifyOutcome = { email: string; check: EmailCheck | null } // null = not checked (no credits left)

// Check a list of emails within a time budget. Stops spending credits when they run out.
export async function verifyEmails(emails: string[], { budgetMs = 20_000 } = {}) {
  const started = Date.now()
  const domains = new Map<string, boolean | null>()
  const done = new Map<string, EmailCheck | null>()
  let outOfCredits = !isEmailApiConfigured()
  let credits: number | null = null
  let apiError: string | null = null

  for (const raw of emails) {
    const email = normaliseEmail(raw)
    if (done.has(email)) continue
    if (Date.now() - started > budgetMs) break

    const basic = basicEmailCheck(email)
    if (basic.status) { done.set(email, basic); continue }

    const accepts = await acceptsMail(email.split('@')[1], domains)
    if (accepts === false) {
      done.set(email, { ...basic, status: 'invalid', reason: basic.suggestion ? 'Domain does not accept email (typo?)' : 'Domain does not accept email' })
      continue
    }
    if (outOfCredits) { done.set(email, null); continue }

    try {
      const r = await qev(email)
      credits = r.credits ?? credits
      done.set(email, { ...r.check, suggestion: r.check.suggestion || basic.suggestion, role: r.check.role || basic.role })
      if (credits !== null && credits <= 0) outOfCredits = true
    } catch (e) {
      if (e instanceof EmailApiOutOfCredits) { outOfCredits = true; apiError = e.message }
      else apiError = e instanceof Error ? e.message : 'Email check failed.'
      done.set(email, null)
      if (!(e instanceof EmailApiOutOfCredits)) break // API trouble: try again later
    }
  }
  return { results: done, outOfCredits, credits, apiError }
}
