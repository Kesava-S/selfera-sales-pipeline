// Reads a business's own website for contact details (server only).
// Looks at the home page, then a contact page if the home page has no email.
// Plain HTTP requests: no paid scraping service. Pages that only build their
// content with JavaScript may show nothing, which is fine (we simply find no email).

import { promises as dns } from 'node:dns'
import net from 'node:net'

const MAX_BYTES = 600_000
const PAGE_TIMEOUT_MS = 7_000
const UA = 'Mozilla/5.0 (compatible; SelferaLeadFinder/1.0; +https://www.selfera.co.uk)'

// Addresses on the private network, the machine itself, or cloud metadata are never fetched
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  const v = ip.toLowerCase()
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') ||
    (v.startsWith('::ffff:') && isPrivateIp(v.slice(7)))
}

async function isPublicHost(hostname: string): Promise<boolean> {
  const host = hostname.replace(/^\[|\]$/g, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false
  if (net.isIP(host)) return !isPrivateIp(host)
  try {
    const addrs = await dns.lookup(host, { all: true })
    return addrs.length > 0 && addrs.every(a => !isPrivateIp(a.address))
  } catch {
    return false
  }
}

export function normaliseWebsite(raw: string | null | undefined): URL | null {
  if (!raw?.trim()) return null
  try {
    const u = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u
  } catch {
    return null
  }
}

// One page, following redirects by hand so every hop is checked
async function fetchPage(url: URL, hops = 0): Promise<{ html: string; url: URL } | null> {
  if (hops > 3 || !(await isPublicHost(url.hostname))) return null
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      cache: 'no-store',
    })
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location')
      if (!next) return null
      return fetchPage(new URL(next, url), hops + 1)
    }
    if (!res.ok || !(res.headers.get('content-type') || '').includes('html')) return null
    const reader = res.body?.getReader()
    if (!reader) return null
    const chunks: Uint8Array[] = []
    let size = 0
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      size += value.length
    }
    reader.cancel().catch(() => {})
    return { html: Buffer.concat(chunks).toString('utf8'), url }
  } catch {
    return null
  }
}

// Cloudflare hides emails as data-cfemail="hex"; decode them back
function decodeCfEmail(hex: string): string | null {
  try {
    const key = parseInt(hex.slice(0, 2), 16)
    let out = ''
    for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key)
    return out
  } catch {
    return null
  }
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi
const JUNK = /\.(png|jpe?g|gif|webp|svg|css|js)$|@(example|domain|email|yourdomain|sentry|wixpress|sentry-next)\.|^(user|name|your|email|example)@/i

function emailsIn(html: string): string[] {
  const found = new Set<string>()
  for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) found.add(decodeURIComponent(m[1]))
  for (const m of html.matchAll(/data-cfemail="([0-9a-f]+)"/gi)) {
    const e = decodeCfEmail(m[1])
    if (e) found.add(e)
  }
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/&#64;|&commat;|\[at\]|\(at\)/gi, '@')
  for (const m of text.matchAll(EMAIL_RE)) found.add(m[0])
  return [...found].map(e => e.trim().toLowerCase().replace(/\.$/, '')).filter(e => !JUNK.test(e) && e.length <= 254)
}

function phonesIn(html: string): string[] {
  return [...new Set([...html.matchAll(/href=["']tel:([^"']+)["']/gi)].map(m => decodeURIComponent(m[1]).replace(/[^\d+]/g, '')).filter(p => p.length >= 7))]
}

function titleOf(html: string): string | null {
  const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1]
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
  const name = (og || title || '').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").split(/\s[|–-]\s/)[0].trim()
  return name || null
}

// The site's own domain first ("info@thecafe.co.uk" beats "someone@gmail.com")
function bestEmail(emails: string[], site: URL): string | null {
  if (!emails.length) return null
  const domain = site.hostname.replace(/^www\./, '')
  const own = emails.filter(e => e.endsWith(`@${domain}`) || e.split('@')[1]?.endsWith(`.${domain}`))
  return (own[0] ?? emails[0]) || null
}

export type WebsiteContacts = {
  email: string | null
  emails: string[]
  phone: string | null
  name: string | null
  pageUrl: string | null
}

export async function readWebsiteContacts(website: string | null | undefined): Promise<WebsiteContacts | null> {
  const site = normaliseWebsite(website)
  if (!site) return null
  const home = await fetchPage(site)
  if (!home) return null

  let emails = emailsIn(home.html)
  let pageUrl = home.url.toString()
  const phones = phonesIn(home.html)

  // No email on the home page: try the contact page it links to, else the usual addresses
  if (!emails.length) {
    const linked = [...home.html.matchAll(/href=["']([^"'#]*contact[^"'#]*)["']/gi)].map(m => m[1])[0]
    const candidates = [linked, '/contact', '/contact-us'].filter(Boolean) as string[]
    for (const c of candidates.slice(0, 2)) {
      let target: URL
      try { target = new URL(c, home.url) } catch { continue }
      if (target.hostname.replace(/^www\./, '') !== home.url.hostname.replace(/^www\./, '')) continue
      const page = await fetchPage(target)
      if (!page) continue
      emails = emailsIn(page.html)
      phones.push(...phonesIn(page.html))
      if (emails.length) { pageUrl = page.url.toString(); break }
    }
  }

  return {
    email: bestEmail(emails, home.url),
    emails: emails.slice(0, 5),
    phone: phones[0] ?? null,
    name: titleOf(home.html),
    pageUrl,
  }
}
