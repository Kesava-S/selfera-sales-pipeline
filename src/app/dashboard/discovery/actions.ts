'use server'

import { revalidatePath, unstable_cache } from 'next/cache'
import { requireUser, requireProfile } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { parseAndValidatePhone, getPhoneType } from '@/lib/contact'
import { applyPhoneDefaults, getSalesLists } from '@/lib/dynamicData'
import { searchCompanies } from '@/lib/enrich'
import { actsAsSales } from '@/lib/config'
import { readWebsiteContacts, normaliseWebsite } from '@/lib/websiteContacts'
import { verifyEmails } from '@/lib/emailVerify'
import type { EmailCheck } from '@/lib/emailCheck'
import { matchCategory, type SalesLists } from '@/lib/lists'

export interface DiscoveredProspect {
  id: string
  business_name: string
  category: string
  business_type: string
  area: string
  address: string
  postcode: string
  phone: string | null
  whatsapp_number?: string | null
  email: string | null
  existing_website: string | null
  has_no_website?: boolean
  maps_link: string | null
  google_rating: number | null
  google_reviews_count: number | null
  contact_name: string | null
  opportunity_signal: string
  opportunity_pitch: string
  source_provider: string
  company_number?: string | null
  company_status?: string | null
  company_type?: string | null
  registered_address?: string | null
  directors_list?: string[]
  is_sme?: boolean
  company_incorporated?: string | null
  company_age_years?: number | null
  email_source?: string | null       // the web page the email was found on
  email_check?: EmailCheck | null    // result of the email checks (null = not checked)
}

// An email found on a business's website
export interface EmailFinding {
  id: string
  email: string | null
  email_source: string | null
  checked: boolean                   // false = the website could not be read
  email_check?: EmailCheck | null
}

export interface ImportResult {
  success: boolean
  importedCount: number
  skippedCount: number
  existingCount?: number   // already in Lead Management
  optedOutCount?: number   // on the do-not-contact list
  error?: string
}

// A discovered business that is already a lead, or is on the do-not-contact list
export interface ExistingMatch {
  id: string               // prospect id
  business_id?: string
  business_name?: string
  matched_by: string       // 'phone' | 'email' | 'maps listing' | 'name and postcode' | 'do not contact'
  opted_out?: boolean
}

export interface DiscoveryQuery {
  query?: string
  city?: string
  postcode?: string
  category?: string
  url?: string
  mode?: 'query' | 'url'
  smeOnly?: boolean
  minReviews?: number
  maxReviews?: number
  minRating?: number
  maxRating?: number
  page?: number            // SerpAPI results page (20 per page), 0 = first
}

export interface SerpApiAccountInfo {
  total_searches_left: number
  searches_per_month: number
  this_month_usage: number
  plan_name: string
  plan_renewal_date?: string
}

export interface DiscoveryResponse {
  success: boolean
  isLive: boolean
  prospects: DiscoveredProspect[]
  message?: string
  error?: string
  serpApiBalance?: SerpApiAccountInfo | null
  hasMore?: boolean        // SerpAPI has another page of results
  fromCache?: boolean      // a saved search (no SerpAPI credit used)
}

/**
 * Fetch current SerpApi account balance and remaining searches.
 */
export async function getSerpApiBalance(): Promise<SerpApiAccountInfo | null> {
  const serpKey = process.env.SERPAPI_API_KEY
  if (!serpKey) return null
  try { await requireDiscoveryRole() } catch { return null }

  try {
    const res = await fetch(`https://serpapi.com/account?api_key=${serpKey}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(6_000),
    })

    if (!res.ok) return null
    const data = await res.json()
    return {
      total_searches_left: typeof data.total_searches_left === 'number' ? data.total_searches_left : (data.plan_searches_left ?? 0),
      searches_per_month: typeof data.searches_per_month === 'number' ? data.searches_per_month : 0,
      this_month_usage: typeof data.this_month_usage === 'number' ? data.this_month_usage : 0,
      plan_name: data.plan_name || 'Free Plan',
      plan_renewal_date: data.plan_renewal_date,
    }
  } catch (err) {
    console.warn('[SerpApi] Failed to fetch account balance:', err)
    return null
  }
}

function extractUkPostcode(text: string): string {
  const match = text.match(/\b([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})\b/i)
  return match ? match[0].toUpperCase() : ''
}

function cleanBusinessTitle(rawTitle: string): string {
  if (!rawTitle) return ''
  return rawTitle
    .replace(/\s*[-–|:]\s*(Tripadvisor|Yelp|Google Maps|Home|Official Site|Facebook|LinkedIn|Instagram|Twitter|X).*/i, '')
    .trim()
}

// Known national franchise brands and enterprise chains to exclude from SME targeting
const KNOWN_CHAINS = [
  'mcdonald', 'subway', 'starbucks', 'costa', 'greggs', 'kfc', 'burger king',
  'pizza hut', 'domino', 'nando', 'wetherspoon', 'premier inn', 'travelodge',
  'hilton', 'marriott', 'tesco', 'sainsbury', 'asda', 'morrisons', 'aldi', 'lidl',
  'waitrose', 'boots', 'superdrug', 'currys', 'argos', 'b&q', 'screwfix',
  'toolstation', 'halfords', 'marks & spencer', 'm&s', 'primark', 'specsavers',
  'vision express', 'holland & barrett', 'anytime fitness', 'puregym', 'the gym group',
  'david lloyd', 'nuffield health', 'harvester', 'toby carvery', 'frankie & benny',
  'zizzi', 'prezzo', 'pizzaexpress', 'bella italia', 'caffè nero', 'caffe nero'
]

function isNationalChain(title: string): boolean {
  if (!title) return false
  const lower = title.toLowerCase()
  return KNOWN_CHAINS.some((chain) => lower.includes(chain))
}

function evaluateIsSme(p: {
  business_name: string
  reviews?: number | null
  rating?: number | null
  phone?: string | null
  website?: string | null
  company_type?: string | null
}): boolean {
  // 1. Exclude national chains and large franchises
  if (isNationalChain(p.business_name)) return false

  // 2. Exclude public limited companies (large corporate PLCs)
  const cType = p.company_type?.toLowerCase() || ''
  if (cType === 'plc' || cType.includes('public limited')) return false

  // 3. Exclude massive enterprises with huge review counts (> 250 reviews)
  if (typeof p.reviews === 'number' && p.reviews > 250) return false

  // 4. Exclude ghost or unverified listings that have neither phone nor website
  if (!p.phone && !p.website) return false

  // 5. Exclude single-review forged listings (e.g. 5.0 rating with 1 review and no website)
  if (p.reviews === 1 && !p.website) return false

  return true
}

// Growing SME = a small business (above) with at least one sign of growth:
// an established but still small review base, or a company formed in the last 10 years.
// Closed or dissolved companies never count.
function classifyGrowingSme(p: DiscoveredProspect): boolean {
  const status = p.company_status?.toLowerCase() || ''
  if (status && status !== 'active') return false
  if (!evaluateIsSme({
    business_name: p.business_name,
    reviews: p.google_reviews_count,
    rating: p.google_rating,
    phone: p.phone,
    website: p.existing_website,
    company_type: p.company_type,
  })) return false
  const reviews = p.google_reviews_count ?? 0
  const age = p.company_age_years
  const growingReviews = reviews >= 10 && reviews <= 250
  const youngCompany = typeof age === 'number' && age >= 1 && age <= 10
  return growingReviews || youngCompany
}

// "The Rose & Crown Ltd" -> "rose crown": compare business names without legal words and punctuation
const nameKey = (s: string) => s.toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/\b(the|ltd|limited|llp|plc|co|company|uk|and)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

// Companies House search returns the closest names, not always the same business:
// accept a match only when the names agree.
function sameCompany(listingName: string, companyName: string): boolean {
  const a = nameKey(listingName)
  const b = nameKey(companyName)
  if (!a || !b) return false
  return a === b || (a.length >= 4 && b.startsWith(a)) || (b.length >= 4 && a.startsWith(b))
}

// Companies House company types -> our Lead Management company_type values
function companyTypeForLead(type?: string | null): string {
  const t = (type || '').toLowerCase()
  if (['ltd', 'private-unlimited', 'private-limited-guarant-nsc', 'private-limited-guarant-nsc-limited-exemption', 'private-limited-shares-section-30-exemption'].includes(t)) return 'Limited company'
  if (['llp', 'limited-partnership', 'scottish-partnership'].includes(t)) return 'Partnership'
  return 'Unknown'
}

// What the listing suggests is worth pitching (shown in results; not a verification)
function listingSignal(p: { existing_website: string | null; google_rating: number | null; google_reviews_count: number | null; is_sme?: boolean }) {
  const rating = p.google_rating
  const reviews = p.google_reviews_count
  if (!p.existing_website) return { signal: 'No website on Google listing', pitch: 'Website and online booking' }
  if (rating && rating < 4.2) return { signal: `Rating ${rating} from ${reviews || 0} reviews`, pitch: 'Review and retention automation' }
  if (reviews && reviews > 50) return { signal: `${reviews} reviews (${rating ?? '–'} rating)`, pitch: 'WhatsApp booking and review automation' }
  return { signal: p.is_sme ? 'Growing SME' : 'Local business', pitch: 'WhatsApp booking and automation' }
}

// Google's place type ("Italian restaurant", "Bed & breakfast") -> one of our lead categories,
// using each category's known spellings; null when nothing fits (Lead Management then asks for one)
function categoryFor(lists: SalesLists, ...values: (string | null | undefined)[]): string | null {
  for (const v of values) {
    if (!v) continue
    const whole = matchCategory(lists, v)
    if (whole) return whole
    const words = v.toLowerCase().replace(/[^a-z& ]+/g, ' ').split(/\s+/).filter(w => w.length > 2)
    for (let i = words.length - 1; i >= 0; i--) {
      const hit = matchCategory(lists, words[i])
      if (hit) return hit
    }
  }
  return null
}

// A phone that can take WhatsApp (mobile), in international form; landlines stay phone-only
function whatsappFrom(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null
  const type = getPhoneType(phone.trim())
  if (!type.isWhatsApp) return null
  const check = parseAndValidatePhone(phone.trim())
  return check.valid ? check.normalized ?? null : null
}

// Look up a listing on Companies House and copy across what matches
async function enrichFromCompaniesHouse(p: DiscoveredProspect) {
  try {
    const companies = await searchCompanies(p.business_name.split(/[|:]/)[0].trim())
    const named = companies.filter(c => sameCompany(p.business_name, c.name))
    if (!named.length) return
    // Same name: prefer the same postcode, then the same postcode area (HU1, YO1 ...).
    // The registered office is often an accountant's address, so a name match alone still counts.
    const pc = (p.postcode || '').toUpperCase().replace(/\s+/g, '')
    const outward = (p.postcode || '').toUpperCase().trim().split(/\s+/)[0]
    const addr = (c: { address: string | null }) => (c.address || '').toUpperCase()
    const match =
      (pc && named.find(c => addr(c).replace(/\s+/g, '').includes(pc))) ||
      (outward && named.find(c => new RegExp(`\\b${outward}\\b`).test(addr(c)))) ||
      named.find(c => (c.status || '').toLowerCase() === 'active') ||
      named[0]
    if (match.directors?.length) {
      p.contact_name = match.directors[0]
      p.directors_list = match.directors
    }
    p.company_number = match.number || null
    p.company_status = match.status || null
    p.company_type = match.type || null
    p.registered_address = match.address || null
    if (match.incorporated) {
      p.company_incorporated = match.incorporated
      const year = parseInt(match.incorporated.slice(0, 4), 10)
      if (!isNaN(year)) p.company_age_years = Math.max(0, new Date().getFullYear() - year)
    }
  } catch {
    // No Companies House match is fine
  }
}

/**
 * Search local businesses via SerpApi Google Maps engine.
 */
type SerpPage = { results: any[]; hasMore: boolean; fetchedAt: number }

// One SerpAPI Google Maps page. Successful searches are kept for 24 hours and reused,
// so repeating a search (or paging back) costs no credits. Failed searches are not kept.
async function fetchSerpPage(query: string, gl: string, page: number): Promise<SerpPage> {
  const params = new URLSearchParams({ engine: 'google_maps', type: 'search', q: query, hl: 'en', api_key: process.env.SERPAPI_API_KEY || '' })
  if (gl) params.set('gl', gl)
  // Google Maps gives 20 results a page; SerpAPI pages with start=0, 20, 40 ...
  if (page > 0) params.set('start', String(page * 20))
  const res = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(15_000), cache: 'no-store' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.error) {
    // "no results" is an empty search, not a failure
    if (/hasn't returned any results/i.test(json.error || '')) return { results: [], hasMore: false, fetchedAt: Date.now() }
    throw new Error(json.error || `SerpAPI returned HTTP ${res.status}`)
  }
  const results = Array.isArray(json.local_results) ? json.local_results : []
  return { results, hasMore: Boolean(json.serpapi_pagination?.next) && results.length >= 20, fetchedAt: Date.now() }
}

const cachedSerpSearch = (key: string, query: string, gl: string, page: number) =>
  unstable_cache(() => fetchSerpPage(query, gl, page), ['discovery-serp-v1', key], { revalidate: 24 * 60 * 60 })()

async function searchSerpApi(
  query: string,
  fallbackCategory?: string,
  fallbackCity?: string,
  fallbackPostcode?: string,
  page: number = 0
): Promise<{ prospects: DiscoveredProspect[]; hasMore: boolean; fromCache: boolean }> {
  if (!process.env.SERPAPI_API_KEY) return { prospects: [], hasMore: false, fromCache: false }

  // Search in the default country from Settings (phone_defaults), so "Hull" finds Hull, England
  const country = (await getSalesLists()).phone?.country
  const gl = country && /^[A-Z]{2}$/.test(country) ? country.toLowerCase() : ''
  const key = `${gl}|${query.trim().toLowerCase().replace(/\s+/g, ' ')}|${page}`
  const before = Date.now()
  const { results, hasMore, fetchedAt } = await cachedSerpSearch(key, query, gl, page)
  const fromCache = fetchedAt < before

  const prospects = results
    // Closed businesses aren't leads
    .filter((item: any) => !/permanently closed|temporarily closed/i.test(item.open_state || item.business_status || ''))
    .map((item: any, idx: number): DiscoveredProspect => {
      const bName = cleanBusinessTitle(item.title) || `Business ${page * 20 + idx + 1}`
      const fullAddress = item.address || ''
      const postcode = extractUkPostcode(fullAddress) || fallbackPostcode || ''
      const phone = item.phone || null
      const website = item.website || item.links?.website || null
      const rating = typeof item.rating === 'number' ? item.rating : null
      const reviews = typeof item.reviews === 'number' ? item.reviews : null
      // Area: the town from the address ("1 High St, Leeds LS1 1AA" -> "Leeds"), else the searched city
      const parts = fullAddress.split(',').map((s: string) => s.trim()).filter(Boolean)
      const town = parts.length > 1 ? parts[parts.length - 1].replace(postcode, '').trim() : ''
      const type = item.type || (Array.isArray(item.types) ? item.types[0] : '') || fallbackCategory || 'General business'

      return {
        id: `serp-${item.place_id || item.data_id || `${page}-${idx}`}`,
        business_name: bName,
        category: type,
        business_type: type,
        area: town || fallbackCity || '',
        address: fullAddress,
        postcode,
        phone,
        whatsapp_number: whatsappFrom(phone),
        email: null,
        existing_website: website,
        has_no_website: !website,
        maps_link: item.place_id ? `https://www.google.com/maps/place/?q=place_id:${item.place_id}` : null,
        google_rating: rating,
        google_reviews_count: reviews,
        contact_name: null,
        opportunity_signal: '',
        opportunity_pitch: '',
        source_provider: 'Google Maps',
      }
    })

  return { prospects, hasMore, fromCache }
}

// Lead Discovery is for admin and sales (the page and sidebar say the same)
async function requireDiscoveryRole() {
  const { profile } = await requireProfile()
  if (!profile || !(profile.role === 'admin' || actsAsSales(profile.role))) {
    throw new Error('Lead Discovery is for the admin and sales team.')
  }
  return profile
}

/**
 * Find businesses: SerpAPI (Google Maps) search, Companies House details, growing-SME flag.
 * A website address instead of a keyword reads that one website.
 */
export async function discoverProspects(params: DiscoveryQuery): Promise<DiscoveryResponse> {
  try {
    await requireDiscoveryRole()
  } catch (err) {
    return { success: false, isLive: false, prospects: [], error: err instanceof Error ? err.message : 'Not allowed.' }
  }
  const hasCompaniesHouse = Boolean(process.env.COMPANIES_HOUSE_API_KEY)
  const hasSerpApi = Boolean(process.env.SERPAPI_API_KEY)

  // 1. A website address: read that site for its name, phone and email
  if (params.url) {
    const site = normaliseWebsite(params.url)
    if (!site) return { success: false, isLive: true, prospects: [], error: 'That website address is not valid.' }
    const contacts = await readWebsiteContacts(site.toString())
    if (!contacts) return { success: false, isLive: true, prospects: [], error: 'Could not read that website (it may block automated visits).' }
    await applyPhoneDefaults()
    const prospect: DiscoveredProspect = {
      id: `site-${site.hostname}`,
      business_name: contacts.name || site.hostname.replace(/^www\./, ''),
      category: params.category && params.category !== 'All Categories' ? params.category : 'General business',
      business_type: params.category && params.category !== 'All Categories' ? params.category : 'General business',
      area: params.city?.trim() || '',
      address: '',
      postcode: params.postcode?.trim() || '',
      phone: contacts.phone,
      whatsapp_number: whatsappFrom(contacts.phone),
      email: contacts.email,
      email_source: contacts.email ? contacts.pageUrl : null,
      existing_website: site.toString(),
      has_no_website: false,
      maps_link: null,
      google_rating: null,
      google_reviews_count: null,
      contact_name: null,
      opportunity_signal: '',
      opportunity_pitch: '',
      source_provider: 'Website',
    }
    if (hasCompaniesHouse) await enrichFromCompaniesHouse(prospect)
    prospect.is_sme = classifyGrowingSme(prospect)
    Object.assign(prospect, (({ signal, pitch }) => ({ opportunity_signal: signal, opportunity_pitch: pitch }))(listingSignal(prospect)))
    if (prospect.email) {
      const { results } = await verifyEmails([prospect.email], { useApi: false })
      prospect.email_check = results.get(prospect.email) ?? null
    }
    return { success: true, isLive: true, prospects: [prospect], message: 'Read 1 website.' }
  }

  if (!hasSerpApi) {
    return { success: false, isLive: false, prospects: [], error: 'SerpAPI is not set up: add SERPAPI_API_KEY.' }
  }

  // 2. Keyword search
  const searchTerms = [
    params.query?.trim(),
    params.category && params.category !== 'All Categories' ? params.category : '',
    params.city?.trim() && params.city !== 'All Cities' ? params.city : '',
    params.postcode?.trim(),
  ]
    .filter(Boolean)
    .join(' ')

  if (!searchTerms) {
    return { success: true, isLive: true, prospects: [], message: 'Enter a keyword, city, postcode or website address.' }
  }

  try {
    await applyPhoneDefaults()
    const page = Math.max(0, Math.min(Math.floor(params.page ?? 0), 5)) // SerpAPI serves up to 120 results
    const { prospects: serpProspects, hasMore, fromCache } = await searchSerpApi(
      searchTerms,
      params.category && params.category !== 'All Categories' ? params.category : undefined,
      params.city && params.city !== 'All Cities' ? params.city : undefined,
      params.postcode?.trim() || undefined,
      page
    )

    // Companies House: company status, age and directors, for names (and postcodes) that match
    if (hasCompaniesHouse) {
      for (let i = 0; i < serpProspects.length; i += 5) {
        await Promise.all(serpProspects.slice(i, i + 5).map(enrichFromCompaniesHouse))
      }
    }
    for (const p of serpProspects) {
      p.is_sme = classifyGrowingSme(p)
      const { signal, pitch } = listingSignal(p)
      p.opportunity_signal = signal
      p.opportunity_pitch = pitch
    }

    // Every business is returned with its Growing SME flag; the page filters, so the
    // "Growing SMEs only" switch works without searching (and paying) again
    const growing = serpProspects.filter((p) => p.is_sme).length
    const balance = await getSerpApiBalance()

    return {
      success: true,
      isLive: true,
      prospects: serpProspects,
      hasMore,
      fromCache,
      message: serpProspects.length === 0
        ? 'No businesses found matching your search.'
        : `Found ${serpProspects.length} businesses, ${growing} growing SMEs${fromCache ? ' (saved search, no credit used)' : ''}.`,
      serpApiBalance: balance,
    }
  } catch (serpErr) {
    const message = serpErr instanceof Error ? serpErr.message : 'Network error'
    console.warn('SerpApi lookup failed:', message)
    return { success: false, isLive: true, prospects: [], error: `Search failed: ${message}`, serpApiBalance: await getSerpApiBalance() }
  }
}

// A website's contact details are kept for a day, so repeat searches don't read it again
const cachedWebsiteContacts = (website: string) =>
  unstable_cache(() => readWebsiteContacts(website), ['discovery-site-v1', website.toLowerCase()], { revalidate: 24 * 60 * 60 })()

/**
 * Read each business's website for an email address, then run the free email checks
 * (format, throwaway domains, does the domain take email). The paid inbox check runs
 * only for the leads you add (in importDiscoveredProspects), to save credits.
 */
export async function findProspectEmails(prospects: DiscoveredProspect[]): Promise<EmailFinding[]> {
  await requireDiscoveryRole()
  // Growing SMEs first, so the leads you are most likely to add are read first
  const todo = (prospects || []).filter(p => p.existing_website && !p.email)
    .sort((x, y) => Number(Boolean(y.is_sme)) - Number(Boolean(x.is_sme)))
    .slice(0, 40)
  const started = Date.now()
  const found: EmailFinding[] = []

  for (let i = 0; i < todo.length; i += 10) {
    if (Date.now() - started > 40_000) break // keep the request short; the rest can be read again
    await Promise.all(todo.slice(i, i + 10).map(async p => {
      const c = await cachedWebsiteContacts(p.existing_website || '').catch(() => null)
      found.push({ id: p.id, email: c?.email ?? null, email_source: c?.email ? c.pageUrl : null, checked: Boolean(c) })
    }))
  }

  const emails = found.map(f => f.email).filter(Boolean) as string[]
  if (emails.length) {
    const { results } = await verifyEmails(emails, { budgetMs: 10_000, useApi: false })
    for (const f of found) if (f.email) f.email_check = results.get(f.email) ?? null
  }
  return found
}

/**
 * Which discovered businesses are already leads (by phone, email, Google listing, or
 * name and postcode), and which are on the do-not-contact list.
 */
export async function checkDiscoveredProspects(prospects: DiscoveredProspect[]): Promise<ExistingMatch[]> {
  try {
    await requireDiscoveryRole()
    const { supabase } = await requireUser()
    if (!prospects?.length) return []
    await applyPhoneDefaults()

    const phones = prospects.map(p => {
      const c = p.phone?.trim() ? parseAndValidatePhone(p.phone.trim()) : null
      return c?.valid ? c.normalized ?? null : null
    })
    const out = new Map<string, ExistingMatch>()

    // 1. Same checks as the Lead Management import (WhatsApp, email, name and postcode)
    const { data: dupes } = await supabase.rpc('find_duplicates', {
      p_rows: prospects.map((p, idx) => ({
        idx, business_name: p.business_name, whatsapp_number: p.whatsapp_number || phones[idx] || '',
        email: p.email || '', postcode: p.postcode || '',
      })),
    })
    for (const d of (dupes || []) as { idx: number; business_id: string; business_name: string; matched_by: string }[]) {
      const p = prospects[d.idx]
      if (p) out.set(p.id, { id: p.id, business_id: d.business_id, business_name: d.business_name, matched_by: d.matched_by === 'whatsapp' ? 'phone' : d.matched_by })
    }

    // 2. Same phone number (landlines too) or the same Google Maps listing
    const phoneList = [...new Set(phones.filter(Boolean) as string[])]
    const mapsList = [...new Set(prospects.map(p => p.maps_link).filter(Boolean) as string[])]
    const db = createServiceClient()
    const [byPhone, byMaps] = await Promise.all([
      phoneList.length ? db.from('businesses').select('id, business_name, phone_normalised').in('phone_normalised', phoneList) : Promise.resolve({ data: [] }),
      mapsList.length ? db.from('businesses').select('id, business_name, maps_link').in('maps_link', mapsList) : Promise.resolve({ data: [] }),
    ])
    prospects.forEach((p, idx) => {
      if (out.has(p.id)) return
      const m = (byMaps.data as { id: string; business_name: string; maps_link: string }[] | null)?.find(b => b.maps_link === p.maps_link)
      if (m) { out.set(p.id, { id: p.id, business_id: m.id, business_name: m.business_name, matched_by: 'maps listing' }); return }
      const ph = phones[idx] && (byPhone.data as { id: string; business_name: string; phone_normalised: string }[] | null)?.find(b => b.phone_normalised === phones[idx])
      if (ph) out.set(p.id, { id: p.id, business_id: ph.id, business_name: ph.business_name, matched_by: 'phone' })
    })

    // 3. Do-not-contact list (any channel)
    const identifiers = [...new Set([...phoneList, ...phoneList.map(n => n.replace(/^\+/, '')), ...prospects.map(p => p.email?.trim().toLowerCase()).filter(Boolean) as string[]])]
    if (identifiers.length) {
      const { data: opted } = await db.from('opt_outs').select('identifier').in('identifier', identifiers)
      const set = new Set((opted || []).map(o => String(o.identifier).toLowerCase()))
      prospects.forEach((p, idx) => {
        const ph = phones[idx]
        const hit = (ph && (set.has(ph.toLowerCase()) || set.has(ph.replace(/^\+/, '')))) || (p.email && set.has(p.email.trim().toLowerCase()))
        if (hit) out.set(p.id, { ...(out.get(p.id) || { id: p.id }), matched_by: 'do not contact', opted_out: true })
      })
    }

    return [...out.values()]
  } catch (err) {
    console.error('checkDiscoveredProspects error:', err)
    return []
  }
}

/**
 * Add the chosen businesses to Lead Management as new leads, the same way the
 * Lead Management import does: one import batch, each lead "Needs review", unassigned.
 * No outreach is started here; that happens in Lead Management.
 * Leads that already exist, or are on the do-not-contact list, are skipped.
 */
export async function importDiscoveredProspects(
  prospects: DiscoveredProspect[],
  servicePitched: string = 'Website',
  searchLabel?: string
): Promise<ImportResult> {
  try {
    const { supabase } = await requireUser()
    const { profile } = await requireProfile()
    if (!profile) return { success: false, importedCount: 0, skippedCount: 0, error: 'Your account is not configured.' }
    if (!(profile.role === 'admin' || actsAsSales(profile.role))) {
      return { success: false, importedCount: 0, skippedCount: 0, error: 'Only admin and sales can add leads.' }
    }
    if (!prospects?.length) return { success: false, importedCount: 0, skippedCount: 0, error: 'No businesses selected.' }

    await applyPhoneDefaults()

    const matches = new Map((await checkDiscoveredProspects(prospects)).map(m => [m.id, m]))
    const existingCount = [...matches.values()].filter(m => !m.opted_out).length
    const optedOutCount = [...matches.values()].filter(m => m.opted_out).length
    const fresh = prospects.filter(p => p.business_name.trim() && !matches.has(p.id))
    if (!fresh.length) {
      return { success: true, importedCount: 0, skippedCount: prospects.length, existingCount, optedOutCount }
    }

    // One batch per push, so the leads can be found together in Lead Management
    const label = `Lead Discovery: ${(searchLabel || fresh[0].business_type || 'search').slice(0, 80)} (${new Date().toISOString().slice(0, 10)})`
    const { data: batchId } = await supabase.rpc('create_import_batch', { p_file_name: label })

    // Full email check (inbox exists?) only for the leads being added, to save credits
    const freshEmails = fresh.map(p => p.email?.trim().toLowerCase()).filter(Boolean) as string[]
    const emailChecks = freshEmails.length
      ? (await verifyEmails(freshEmails, { budgetMs: 25_000 }).catch(() => null))?.results ?? new Map<string, EmailCheck | null>()
      : new Map<string, EmailCheck | null>()

    const lists = await getSalesLists()
    let importedCount = 0
    let skippedCount = prospects.length - fresh.length
    const services = [servicePitched || 'Website']
    // Users can't insert leads directly (no insert rule); the role was checked above
    const db = createServiceClient()
    const errors: string[] = []

    for (const p of fresh) {
      const phoneCheck = p.phone?.trim() ? parseAndValidatePhone(p.phone.trim()) : null
      const { data: business, error: bErr } = await db
        .from('businesses')
        .insert({
          business_name: p.business_name.trim(),
          // Our category when the Google type fits one; otherwise Lead Management asks for it
          category: categoryFor(lists, p.business_type, p.category) || p.category || null,
          business_type: categoryFor(lists, p.business_type, p.category) || p.business_type || null,
          area: p.area?.trim() || null,
          address: p.address?.trim() || null,
          postcode: p.postcode?.trim().toUpperCase() || null,
          phone: phoneCheck?.valid ? phoneCheck.normalized : p.phone?.trim() || null,
          whatsapp_number: whatsappFrom(p.whatsapp_number || p.phone),
          email: p.email?.trim().toLowerCase() || null,
          existing_website: p.existing_website?.trim() || null,
          has_no_website: !p.existing_website,
          maps_link: p.maps_link?.trim() || null,
          google_rating: p.google_rating ?? null,
          google_reviews_count: p.google_reviews_count ?? null,
          contact_name: p.contact_name?.trim() || null,
          company_type: companyTypeForLead(p.company_type),
          gaps_found: p.opportunity_signal || null,
          source: `Lead Discovery (${p.source_provider || 'Google Maps'})`,
          import_batch_id: batchId || null,
        })
        .select('id')
        .single()

      if (bErr || !business) {
        console.error('Failed to add discovered business:', bErr?.message)
        errors.push(`${p.business_name}: ${bErr?.message || 'not saved'}`)
        skippedCount++
        continue
      }

      // Email check result, shown in Lead Management (same fields as the import)
      const email = p.email?.trim().toLowerCase()
      const check = email ? (emailChecks.get(email) ?? p.email_check ?? null) : null
      if (email && check?.status) {
        await db.from('businesses').update({
          email_status: check.status,
          email_reason: check.reason ? String(check.reason).slice(0, 200) : null,
          email_suggestion: check.suggestion ? String(check.suggestion).slice(0, 254) : null,
          email_role: check.role === true,
          email_checked_at: new Date().toISOString(),
        }).eq('id', business.id)
      }

      // The lead's pitch, "Needs review" and unassigned (same as the Lead Management import)
      const { error: pErr } = await db.rpc('add_pitch', { p_business_id: business.id, p_services: services, p_demo_link: null })
      if (pErr) console.error('Failed to add pitch for discovered business:', pErr.message)
      importedCount++
    }

    revalidatePath('/dashboard/leads')
    revalidatePath('/dashboard/discovery')
    revalidatePath('/dashboard')

    if (importedCount === 0 && errors.length) {
      return { success: false, importedCount, skippedCount, existingCount, optedOutCount, error: `Could not add leads: ${errors[0]}` }
    }
    return { success: true, importedCount, skippedCount, existingCount, optedOutCount }
  } catch (err: any) {
    console.error('importDiscoveredProspects error:', err)
    return { success: false, importedCount: 0, skippedCount: 0, error: err?.message || 'Failed to add leads.' }
  }
}
