// Email check results and the free checks done in our own code (no network):
// format, throwaway domains, shared inboxes (info@…) and likely typos.
// The network checks (mail server, QuickEmailVerification) are in emailVerify.ts.

export type EmailStatus = 'valid' | 'risky' | 'invalid' | 'disposable' | 'unknown'

export type EmailCheck = {
  status: EmailStatus | null // null = still needs the network checks
  reason: string | null
  suggestion: string | null
  role: boolean
}

export const EMAIL_STATUS_LABEL: Record<EmailStatus, string> = {
  valid: 'Valid',
  risky: 'Risky',
  invalid: 'Invalid',
  disposable: 'Throwaway',
  unknown: 'Unknown',
}

const FORMAT = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/

const DISPOSABLE = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'sharklasers.com', '10minutemail.com', 'temp-mail.org',
  'tempmail.com', 'tempmail.net', 'yopmail.com', 'trashmail.com', 'getnada.com', 'maildrop.cc', 'dispostable.com',
  'throwawaymail.com', 'fakeinbox.com', 'mintemail.com', 'mohmal.com', 'emailondeck.com', 'burnermail.io',
  'mailnesia.com', 'tempinbox.com', 'spamgourmet.com', 'mytemp.email', 'tempr.email', 'discard.email', 'moakt.com',
])

const ROLE = new Set([
  'info', 'sales', 'admin', 'contact', 'hello', 'enquiries', 'enquiry', 'office', 'support', 'team', 'bookings', 'booking',
  'reservations', 'accounts', 'mail', 'help', 'reception', 'marketing', 'hr', 'jobs', 'careers', 'noreply', 'no-reply', 'orders',
])

// Common personal email domains, to spot typos such as gmial.com
const COMMON = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com',
  'live.co.uk', 'icloud.com', 'me.com', 'aol.com', 'msn.com', 'btinternet.com', 'sky.com', 'virginmedia.com',
  'talktalk.net', 'protonmail.com', 'proton.me', 'ymail.com', 'rediffmail.com',
]

function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

export function typoSuggestion(domain: string): string | null {
  if (COMMON.includes(domain)) return null
  const fixedTld = domain.replace(/\.(con|cmo|cm|om|comm)$/, '.com').replace(/\.co\.(uj|ul|k|ukk)$/, '.co.uk')
  if (fixedTld !== domain) return fixedTld
  let best: string | null = null
  let bestD = 3
  for (const c of COMMON) {
    const dd = distance(domain, c)
    if (dd < bestD) { best = c; bestD = dd }
  }
  return bestD <= 2 ? best : null
}

export const normaliseEmail = (email: string) => email.trim().toLowerCase()

// Everything we can tell without the network. status stays null when it looks fine.
export function basicEmailCheck(raw: string): EmailCheck {
  const email = normaliseEmail(raw)
  if (!FORMAT.test(email) || email.length > 254 || email.split('@')[0].length > 64) {
    return { status: 'invalid', reason: 'Not a valid email address', suggestion: null, role: false }
  }
  const [local, domain] = email.split('@')
  const role = ROLE.has(local)
  const fix = typoSuggestion(domain)
  const suggestion = fix ? `${local}@${fix}` : null
  if (DISPOSABLE.has(domain)) return { status: 'disposable', reason: 'Throwaway email service', suggestion: null, role }
  return { status: null, reason: null, suggestion, role }
}
